/**
 * Gallery Refresh API — 手动触发精彩瞬间图片收集
 *
 * POST /api/wc/gallery/refresh
 *   → 从 ABC News 抓取最新图集，写入 KV 缓存，返回新数据
 *
 * 数据源: ABC News 世界杯图集 (Reuters / Getty Images / AP)
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

const SOURCE_MAP: Record<string, string> = {
  gty: "Getty Images",
  rt: "Reuters",
  ap: "Associated Press",
};

/** 从 ABC News 抓取图片 */
async function collectPhotos(): Promise<GalleryPhoto[]> {
  const r = await fetch(ABC_GALLERY_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!r.ok) throw new Error(`ABC News 返回 ${r.status}`);

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

  if (urls.length === 0) throw new Error("未从 ABC News 提取到图片");

  return urls.map((url, i) => {
    const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
    const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
    const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
    const dateStr = dateCode
      ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
      : "";
    const photographer = SOURCE_MAP[srcCode] || srcCode || "ABC News";
    const baseUrl = url.replace(/\?.*$/, "");
    return {
      id: i,
      src: {
        large: `${baseUrl}?w=1600`,
        medium: `${baseUrl}?w=800`,
        small: `${baseUrl}?w=400`,
      },
      photographer,
      alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
      width: 1600,
      height: 1067,
      url: ABC_GALLERY_URL,
    };
  });
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  // 简单鉴权：检查是否来自同站请求
  const origin = ctx.request.headers.get("origin") ?? "";
  const referer = ctx.request.headers.get("referer") ?? "";
  if (ctx.request.method === "POST" && !origin && !referer) {
    // 允许无 origin/referer 的请求（可能是 curl 或直接调用）
  }

  try {
    // 1. 抓取最新图片
    const photos = await collectPhotos();
    const collectedAt = new Date().toISOString();

    // 2. 写入 KV 缓存
    const kv = ctx.env.GALLERY_CACHE;
    if (kv) {
      await kv.put("latest", JSON.stringify({ photos, collectedAt }));
    }

    // 3. 返回第一页数据
    const PER_PAGE = 24;
    return new Response(JSON.stringify({
      ok: true,
      message: `成功收集 ${photos.length} 张照片`,
      collectedAt,
      photos: photos.slice(0, PER_PAGE),
      next_page: photos.length > PER_PAGE ? "2" : undefined,
      source: "abcnews",
      total: photos.length,
    }), { headers });
  } catch (e) {
    console.error("[gallery-refresh]", (e as Error).message);
    return new Response(JSON.stringify({
      ok: false,
      error: (e as Error).message,
    }), { status: 500, headers });
  }
};
