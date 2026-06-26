/**
 * Gallery Refresh API — 手动触发精彩瞬间图片收集
 *
 * POST /api/wc/gallery/refresh
 *   → 从多个来源抓取最新图集，写入 KV 缓存，返回新数据
 *
 * 数据源: ABC News + USA Today + AP News
 */

interface GalleryPhoto {
  id: number;
  src: { large: string; medium: string; small: string };
  photographer: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}

interface Env {
  GALLERY_CACHE?: KVNamespace;
}

const ABC_GALLERY_URL = "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";
const USATODAY_GALLERY_URL = "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";
const APNEWS_GALLERY_URLS = [
  "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
  "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
  "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** 从 ABC News 抓取图片 */
async function collectAbcNews(): Promise<GalleryPhoto[]> {
  const r = await fetch(ABC_GALLERY_URL, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`ABC News 返回 ${r.status}`);

  const html = await r.text();
  const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const m of html.matchAll(imgRE)) {
    const name = m[1].replace(/\?.*$/, "");
    if (!seen.has(name)) { seen.add(name); urls.push(m[0].replace(/\?.*$/, "")); }
  }

  if (urls.length === 0) throw new Error("未从 ABC News 提取到图片");

  const sourceMap: Record<string, string> = { gty: "Getty Images", rt: "Reuters", ap: "Associated Press" };

  return urls.map((url, i) => {
    const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
    const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
    const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
    const dateStr = dateCode ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}` : "";
    const photographer = sourceMap[srcCode] || srcCode || "ABC News";
    const baseUrl = url.replace(/\?.*$/, "");
    return {
      id: 200000 + i,
      src: { large: `${baseUrl}?w=1600`, medium: `${baseUrl}?w=800`, small: `${baseUrl}?w=400` },
      photographer,
      alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
      width: 1600, height: 1067,
      url: ABC_GALLERY_URL,
    };
  });
}

/** 从 USA Today 抓取图片 */
async function collectUsaToday(): Promise<GalleryPhoto[]> {
  const r = await fetch(USATODAY_GALLERY_URL, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`USA Today 返回 ${r.status}`);

  const html = await r.text();
  const imgRE = /https?:\/\/www\.usatoday\.com\/gcdn\/authoring\/authoring-images\/\d{4}\/\d{2}\/\d{2}\/[A-Z]+\/([^"'\s]+\.jpg)/gi;
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const m of html.matchAll(imgRE)) {
    const base = m[0].split("?")[0];
    if (!seen.has(base)) { seen.add(base); urls.push(base); }
  }

  if (urls.length === 0) throw new Error("未从 USA Today 提取到图片");

  return urls.map((url, i) => {
    const fname = url.split("/").pop()?.replace(/\.jpg$/i, "") ?? "";
    let photographer = "USA Today Sports";
    if (fname.includes("getty-images") || fname.includes("gty-")) photographer = "Getty Images";
    else if (fname.includes("afp-")) photographer = "AFP via Getty Images";
    else if (fname.includes("usatsi-")) photographer = "USA Today Sports";
    else if (fname.includes("usp-soccer")) photographer = "USA Today Sports";

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
      width: 1600, height: 900,
      url: USATODAY_GALLERY_URL,
    };
  });
}

/** 从 AP News 抓取图片 */
async function collectApNews(): Promise<GalleryPhoto[]> {
  const allPhotos: GalleryPhoto[] = [];

  for (const galleryUrl of APNEWS_GALLERY_URLS) {
    const r = await fetch(galleryUrl, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;

    const html = await r.text();
    const dimsRE = /https?:\/\/dims\.apnews\.com\/[^"'\s]*url=https?%3A%2F%2Fassets\.apnews\.com%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)/gi;
    const seen = new Set<string>();
    const assetsUrls: string[] = [];

    for (const m of html.matchAll(dimsRE)) {
      const hash = `${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
      if (!seen.has(hash)) { seen.add(hash); assetsUrls.push(`https://assets.apnews.com/${hash}`); }
    }

    if (assetsUrls.length === 0) continue;

    const altMatch = html.match(/og:image:alt"[^>]*content="([^"]+)"/);
    const photographerMatch = altMatch?.[1]?.match(/\(([^)]+)\)$/);
    const photographer = photographerMatch?.[1] ?? "AP Photo";

    for (const au of assetsUrls) {
      allPhotos.push({
        id: 400000 + allPhotos.length,
        src: {
          // dims.apnews.com 有热链保护，直接使用 assets.apnews.com 原图
          large: au,
          medium: au,
          small: au,
        },
        photographer,
        alt: `2026 世界杯精彩瞬间 (${photographer})`,
        width: 1600, height: 1067,
        url: galleryUrl,
      });
    }
  }

  if (allPhotos.length === 0) throw new Error("未从 AP News 提取到图片");

  const seen = new Set<string>();
  const unique = allPhotos.filter(p => { const k = p.src.medium; if (seen.has(k)) return false; seen.add(k); return true; });

  return unique;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    // 1. 并行抓取三个来源（只抓一次，各源失败互不影响）
    const results: Record<string, number> = {};
    const [abcPhotos, usaPhotos, apPhotos] = await Promise.all([
      collectAbcNews().catch((e) => { console.error("[refresh:abc]", (e as Error).message); results.abcnews = -1; return [] as GalleryPhoto[]; }),
      collectUsaToday().catch((e) => { console.error("[refresh:usa]", (e as Error).message); results.usatoday = -1; return [] as GalleryPhoto[]; }),
      collectApNews().catch((e) => { console.error("[refresh:ap]", (e as Error).message); results.apnews = -1; return [] as GalleryPhoto[]; }),
    ]);
    if (results.abcnews !== -1) results.abcnews = abcPhotos.length;
    if (results.usatoday !== -1) results.usatoday = usaPhotos.length;
    if (results.apnews !== -1) results.apnews = apPhotos.length;

    // 2. 合并去重，得到本次完整图集（以 src.medium 为唯一 key）
    const all = [...abcPhotos, ...usaPhotos, ...apPhotos];
    const seen = new Set<string>();
    const current = all.filter(p => { const k = p.src.medium; if (seen.has(k)) return false; seen.add(k); return true; });
    const total = current.length;

    // 三个来源全部失败 → 返回错误，前端据此提示「更新失败」
    if (total === 0) {
      return new Response(JSON.stringify({ ok: false, error: "未能从任何来源获取到图片" }), { status: 502, headers });
    }

    // 3. 读取上次缓存，计算相比上次的「新增」张数
    const collectedAt = new Date().toISOString();
    const kv = ctx.env.GALLERY_CACHE;
    let added = total; // 默认（首次或无缓存）全部算新增

    if (kv) {
      try {
        const prevRaw = await kv.get("latest");
        if (prevRaw) {
          const prev = JSON.parse(prevRaw) as { photos?: GalleryPhoto[] };
          const prevKeys = new Set((prev.photos ?? []).map(p => p.src.medium));
          added = current.filter(p => !prevKeys.has(p.src.medium)).length;
        }
        // 4. 写入新缓存（覆盖 latest）
        await kv.put("latest", JSON.stringify({ photos: current, collectedAt }));
      } catch (e) { console.error("[refresh:kv]", (e as Error).message); }
    }

    return new Response(JSON.stringify({
      ok: true,
      message: added > 0 ? `新增 ${added} 张照片` : "图片已是最新",
      collectedAt,
      results,
      total,
      added,
      photos: current,
    }), { headers });
  } catch (e) {
    console.error("[gallery-refresh]", (e as Error).message);
    return new Response(JSON.stringify({
      ok: false,
      error: (e as Error).message,
    }), { status: 500, headers });
  }
};
