/**
 * Cloudflare Worker: 定时任务
 *   - 每5分钟: 同步世界杯数据到 Supabase
 *   - 每天8点: 从 ABC News 收集照片到 KV
 */

const ABC_GALLERY_URL =
  "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";

const USATODAY_GALLERY_URL =
  "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";

const APNEWS_GALLERY_URLS = [
  "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
  "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
  "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
];

const SOURCE_MAP: Record<string, string> = {
  gty: "Getty Images",
  rt: "Reuters",
  ap: "Associated Press",
};

interface GalleryPhoto {
  id: number;
  src: { large: string; medium: string; small: string };
  photographer: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}

interface GalleryCache {
  collectedAt: string;
  count: number;
  source: string;
  photos: GalleryPhoto[];
}

export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const cron = event.cron;

    // 每天 8:00 — 收集照片到 KV（ABC News + USA Today + AP News）
    if (cron === "0 8 * * *") {
      await collectAllGalleries(env);
      return;
    }

    // 每 5 分钟 — 同步比赛数据
    await syncData(env);
  },

  // 提供 HTTP 入口方便手动触发和调试
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/collect") {
      const result = await collectAllGalleries(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/gallery") {
      const cached = await env.GALLERY_CACHE.get("latest", "json");
      return new Response(JSON.stringify(cached ?? { error: "no cache" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("worldcup-sync worker", { status: 200 });
  },
};

// ========== 综合照片收集 ==========
async function collectAllGalleries(env: Env): Promise<{ ok: boolean; counts: Record<string, number>; error?: string }> {
  const results: Record<string, number> = {};
  let hasError = false;

  // 1. ABC News
  try {
    const abcResult = await collectAbcNews(env);
    results.abcnews = abcResult.count;
    if (!abcResult.ok) hasError = true;
  } catch (e) {
    console.error("[gallery] ABC News 收集异常:", (e as Error).message);
    results.abcnews = -1;
    hasError = true;
  }

  // 2. USA Today
  try {
    const usaResult = await collectUsaToday(env);
    results.usatoday = usaResult.count;
    if (!usaResult.ok) hasError = true;
  } catch (e) {
    console.error("[gallery] USA Today 收集异常:", (e as Error).message);
    results.usatoday = -1;
    hasError = true;
  }

  // 3. AP News
  try {
    const apResult = await collectApNews(env);
    results.apnews = apResult.count;
    if (!apResult.ok) hasError = true;
  } catch (e) {
    console.error("[gallery] AP News 收集异常:", (e as Error).message);
    results.apnews = -1;
    hasError = true;
  }

  console.log(`[gallery] 汇总: ABC=${results.abcnews} USA=${results.usatoday} AP=${results.apnews}`);
  return { ok: !hasError, counts: results };
}

// ========== ABC News 收集 ==========
async function collectAbcNews(env: Env): Promise<{ ok: boolean; count: number; error?: string }> {
  console.log("[gallery:abc] 开始收集 ABC News 照片...");

  try {
    const r = await fetch(ABC_GALLERY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!r.ok) {
      console.error(`[gallery:abc] HTTP ${r.status}`);
      return { ok: false, count: 0, error: `HTTP ${r.status}` };
    }

    const html = await r.text();
    const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const m of html.matchAll(imgRE)) {
      const name = m[1].replace(/\?.*$/, "");
      if (!seen.has(name)) {
        seen.add(name);
        urls.push(m[0].replace(/\?.*$/, ""));
      }
    }

    if (urls.length === 0) {
      console.warn("[gallery:abc] 未发现照片");
      return { ok: false, count: 0, error: "no photos found" };
    }

    const photos: GalleryPhoto[] = urls.map((url, i) => {
      const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
      const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
      const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
      const dateStr = dateCode
        ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
        : "";
      const photographer = SOURCE_MAP[srcCode] || srcCode || "ABC News";

      return {
        id: 200000 + i,
        src: {
          large: `${url}?w=1600`,
          medium: `${url}?w=800`,
          small: `${url}?w=400`,
        },
        photographer,
        alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
        width: 1600,
        height: 1067,
        url: ABC_GALLERY_URL,
      };
    });

    await storePhotos(env, "abcnews", photos);
    console.log(`[gallery:abc] ✅ ${photos.length} 张照片已写入 KV`);
    return { ok: true, count: photos.length };
  } catch (e) {
    console.error("[gallery:abc] 收集失败:", (e as Error).message);
    return { ok: false, count: 0, error: (e as Error).message };
  }
}

// ========== USA Today 收集 ==========
async function collectUsaToday(env: Env): Promise<{ ok: boolean; count: number; error?: string }> {
  console.log("[gallery:usa] 开始收集 USA Today 照片...");

  try {
    const r = await fetch(USATODAY_GALLERY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!r.ok) {
      console.error(`[gallery:usa] HTTP ${r.status}`);
      return { ok: false, count: 0, error: `HTTP ${r.status}` };
    }

    const html = await r.text();

    // 提取 gcdn 图片 URL（USA Today 的 Gannett CDN）
    const imgRE = /https?:\/\/www\.usatoday\.com\/gcdn\/authoring\/authoring-images\/\d{4}\/\d{2}\/\d{2}\/[A-Z]+\/([^"'\s]+\.jpg)/gi;
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const m of html.matchAll(imgRE)) {
      const base = m[0].split("?")[0]; // 去掉 URL 参数
      if (!seen.has(base)) {
        seen.add(base);
        urls.push(base);
      }
    }

    if (urls.length === 0) {
      console.warn("[gallery:usa] 未发现照片");
      return { ok: false, count: 0, error: "no photos found" };
    }

    console.log(`[gallery:usa] 发现 ${urls.length} 张照片`);

    const photos: GalleryPhoto[] = urls.map((url, i) => {
      const fname = url.split("/").pop()?.replace(/\.jpg$/i, "") ?? "";
      // 从文件名解析来源
      let photographer = "USA Today Sports";
      if (fname.includes("getty-images") || fname.includes("gty-")) {
        photographer = "Getty Images";
      } else if (fname.includes("afp-")) {
        photographer = "AFP via Getty Images";
      } else if (fname.includes("usatsi-")) {
        photographer = "USA Today Sports";
      } else if (fname.includes("usp-soccer")) {
        photographer = "USA Today Sports";
      }

      // 从路径提取日期
      const dateMatch = url.match(/authoring-images\/(\d{4})\/(\d{2})\/(\d{2})\//);
      const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "";

      return {
        id: 300000 + i,
        src: {
          large: `${url}?width=1600&height=900&format=pjpg&auto=webp`,
          medium: `${url}?width=800&height=450&format=pjpg&auto=webp`,
          small: `${url}?width=400&height=225&format=pjpg&auto=webp`,
        },
        photographer,
        alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
        width: 1600,
        height: 900,
        url: USATODAY_GALLERY_URL,
      };
    });

    await storePhotos(env, "usatoday", photos);
    console.log(`[gallery:usa] ✅ ${photos.length} 张照片已写入 KV`);
    return { ok: true, count: photos.length };
  } catch (e) {
    console.error("[gallery:usa] 收集失败:", (e as Error).message);
    return { ok: false, count: 0, error: (e as Error).message };
  }
}

// ========== AP News 收集 ==========
async function collectApNews(env: Env): Promise<{ ok: boolean; count: number; error?: string }> {
  console.log("[gallery:ap] 开始收集 AP News 照片...");

  const allPhotos: GalleryPhoto[] = [];
  let totalFetched = 0;

  for (const galleryUrl of APNEWS_GALLERY_URLS) {
    try {
      const r = await fetch(galleryUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      if (!r.ok) {
        console.error(`[gallery:ap] ${galleryUrl.slice(-40)} HTTP ${r.status}`);
        continue;
      }

      const html = await r.text();

      // 提取 dims.apnews.com 图片地址，解码出原始 assets.apnews.com URL
      const dimsRE = /https?:\/\/dims\.apnews\.com\/[^"'\s]*url=https?%3A%2F%2Fassets\.apnews\.com%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)/gi;
      const seen = new Set<string>();
      const assetsUrls: { url: string; hash: string }[] = [];

      for (const m of html.matchAll(dimsRE)) {
        const hash = `${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
        if (!seen.has(hash)) {
          seen.add(hash);
          assetsUrls.push({
            url: `https://assets.apnews.com/${hash}`,
            hash,
          });
        }
      }

      if (assetsUrls.length === 0) continue;

      // 尝试从 og:description / alt text 提取摄影师信息
      const altMatch = html.match(/og:image:alt"[^>]*content="([^"]+)"/);
      const photographerMatch = altMatch?.[1]?.match(/\(([^)]+)\)$/);
      const photographer = photographerMatch?.[1] ?? "AP Photo";

      for (const au of assetsUrls) {
        allPhotos.push({
          id: 400000 + totalFetched,
          src: {
            // 通过 dims 服务生成不同尺寸
            large: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/1600x1067!/quality/90/?url=${encodeURIComponent(au.url)}`,
            medium: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/800x533!/quality/90/?url=${encodeURIComponent(au.url)}`,
            small: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/400x267!/quality/90/?url=${encodeURIComponent(au.url)}`,
          },
          photographer,
          alt: `2026 世界杯精彩瞬间 (${photographer})`,
          width: 1600,
          height: 1067,
          url: galleryUrl,
        });
        totalFetched++;
      }
    } catch (e) {
      console.error("[gallery:ap] fetch error:", (e as Error).message);
    }
  }

  if (allPhotos.length === 0) {
    console.warn("[gallery:ap] 未从任何页面发现照片");
    return { ok: false, count: 0, error: "no photos found" };
  }

  // 去重（基于 hash）
  const seen = new Set<string>();
  const unique = allPhotos.filter(p => {
    const key = p.src.medium;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await storePhotos(env, "apnews", unique);
  console.log(`[gallery:ap] ✅ ${unique.length} 张照片已写入 KV（从 ${APNEWS_GALLERY_URLS.length} 个图集）`);
  return { ok: true, count: unique.length };
}

// ========== KV 存储辅助 ==========
async function storePhotos(env: Env, source: string, photos: GalleryPhoto[]): Promise<void> {
  if (photos.length === 0) return;

  // 读取已有的合并缓存，追加/替换该来源的照片
  let existing: GalleryCache = { collectedAt: new Date().toISOString(), count: 0, source: "merged", photos: [] };
  try {
    const raw = await env.GALLERY_CACHE.get("latest", "json");
    if (raw) {
      existing = raw as GalleryCache;
      // 移除旧同源照片
      existing.photos = existing.photos.filter(p => {
        if (source === "abcnews") return p.id < 300000;
        if (source === "usatoday") return p.id < 300000 || p.id >= 400000;
        if (source === "apnews") return p.id < 400000;
        return true;
      });
    }
  } catch { /* 忽略读取错误 */ }

  existing.photos = [...existing.photos, ...photos];
  existing.count = existing.photos.length;
  existing.collectedAt = new Date().toISOString();

  await env.GALLERY_CACHE.put("latest", JSON.stringify(existing), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
}

// ========== 数据同步 ==========
async function syncData(env: Env): Promise<void> {
  const syncUrl = env.SYNC_URL;
  const syncSecret = env.SYNC_SECRET ?? "";

  if (!syncUrl) {
    console.error("SYNC_URL not configured");
    return;
  }

  try {
    const url = new URL(syncUrl);
    if (syncSecret) url.searchParams.set("secret", syncSecret);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: syncSecret ? { "X-Sync-Secret": syncSecret } : {},
    });

    const data = (await res.json()) as any;
    console.log(`[sync] ${res.status}`, JSON.stringify(data.results ?? data));
  } catch (e) {
    console.error("[sync] failed:", (e as Error).message);
  }
}

interface Env {
  SYNC_URL: string;
  SYNC_SECRET?: string;
  GALLERY_CACHE: KVNamespace;
}
