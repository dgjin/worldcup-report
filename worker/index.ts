/**
 * Cloudflare Worker: 定时任务
 *   - 每5分钟: 同步世界杯数据到 Supabase
 *   - 每天8点: 从 ABC News 收集照片到 KV
 */

const ABC_GALLERY_URL =
  "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";

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

    // 每天 8:00 — 收集照片到 KV
    if (cron === "0 8 * * *") {
      await collectGallery(env);
      return;
    }

    // 每 5 分钟 — 同步比赛数据
    await syncData(env);
  },

  // 提供 HTTP 入口方便手动触发和调试
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/collect") {
      const result = await collectGallery(env);
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

// ========== 照片收集 ==========
async function collectGallery(env: Env): Promise<{ ok: boolean; count: number; error?: string }> {
  console.log("[gallery] 开始收集 ABC News 照片...");

  try {
    const r = await fetch(ABC_GALLERY_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!r.ok) {
      console.error(`[gallery] ABC News HTTP ${r.status}`);
      return { ok: false, count: 0, error: `HTTP ${r.status}` };
    }

    const html = await r.text();

    // 提取图片 URL，去重
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
      console.warn("[gallery] 未发现照片");
      return { ok: false, count: 0, error: "no photos found" };
    }

    console.log(`[gallery] 发现 ${urls.length} 张照片`);

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

    const cache: GalleryCache = {
      collectedAt: new Date().toISOString(),
      count: photos.length,
      source: "abcnews",
      photos,
    };

    // 写入 KV（30 天过期，足够覆盖到下次收集）
    await env.GALLERY_CACHE.put("latest", JSON.stringify(cache), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 天
    });

    console.log(`[gallery] ✅ 收集完成！${photos.length} 张照片已写入 KV`);
    return { ok: true, count: photos.length };
  } catch (e) {
    console.error("[gallery] 收集失败:", (e as Error).message);
    return { ok: false, count: 0, error: (e as Error).message };
  }
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
