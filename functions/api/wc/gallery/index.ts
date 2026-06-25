/**
 * Gallery API endpoint — 2026 美加墨世界杯精彩瞬间。
 *
 * 数据获取策略：
 *   1. KV 缓存     — Worker 每日 8:00 自动收集（最快，无外部请求）
 *   2. NewsAPI     — 真实新闻比赛照片（需 NEWSAPI_KEY，100 次/天）
 *   3. ABC News    — 最佳比赛图集（无需 Key，来自 Reuters/Getty/AP）
 *
 * 缓存策略：KV 缓存 24h / NewsAPI 30min / ABC News 1h
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
  NEWSAPI_KEY?: string;
  GALLERY_CACHE?: KVNamespace;
}

const ABC_GALLERY_URL = "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";
const PER_PAGE = 24;

const NEWS_QUERIES = [
  "World+Cup+2026+football+match",
  "FIFA+World+Cup+USA+Mexico+Canada+soccer",
  "World+Cup+2026+goal+celebration+stadium",
  "世界杯+2026+足球+比赛",
];

// ============ 策略 0: KV 缓存（自动刷新） ============
const KV_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

async function fetchFromKV(kv: KVNamespace): Promise<{ photos: GalleryPhoto[]; collectedAt: string } | null> {
  try {
    const raw = await kv.get("latest", "json");
    if (!raw) return null;
    const data = raw as { photos: GalleryPhoto[]; collectedAt: string };
    if (!data.photos || data.photos.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

/** 后台异步刷新 KV（不阻塞响应） */
async function bgRefreshKV(kv: KVNamespace): Promise<void> {
  try {
    const photos = await fetchAbcNews();
    if (photos && photos.length > 0) {
      await kv.put("latest", JSON.stringify({ photos, collectedAt: new Date().toISOString() }));
      console.log(`[gallery] KV 后台刷新成功，${photos.length} 张照片`);
    }
  } catch (e) {
    console.error("[gallery] KV 后台刷新失败:", (e as Error).message);
  }
}

// ============ 策略 1: NewsAPI 真实新闻照片 ============
async function fetchNewsApi(key: string, page: number): Promise<GalleryPhoto[] | null> {
  const q = NEWS_QUERIES[(page - 1) % NEWS_QUERIES.length];
  try {
    const r = await fetch(
      `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&language=en&pageSize=${PER_PAGE}&page=1&apiKey=${key}`,
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      articles?: { title: string; urlToImage: string | null; url: string; source: { name: string } }[];
    };
    const articles = (d.articles ?? []).filter(a => a.urlToImage);
    if (articles.length === 0) return null;
    return articles.map((a, i) => ({
      id: page * 10000 + i,
      src: { large: a.urlToImage!, medium: a.urlToImage!, small: a.urlToImage! },
      photographer: a.source.name,
      alt: a.title || "World Cup 2026",
      width: 1200,
      height: 675,
      url: a.url,
    }));
  } catch {
    return null;
  }
}

// ============ 策略 2: ABC News 图集 ============
async function fetchAbcNews(): Promise<GalleryPhoto[] | null> {
  try {
    const r = await fetch(ABC_GALLERY_URL);
    if (!r.ok) return null;
    const html = await r.text();

    const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
    const seen = new Set<string>();
    const matches: string[] = [];
    for (const m of html.matchAll(imgRE)) {
      const name = m[1].replace(/\?.*$/, "");
      if (!seen.has(name)) { seen.add(name); matches.push(m[0].replace(/\?.*$/, "")); }
    }

    if (matches.length === 0) return null;

    const sourceMap: Record<string, string> = {
      gty: "Getty Images",
      rt: "Reuters",
      ap: "Associated Press",
    };

    return matches.map((url, i) => {
      const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
      const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
      const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
      const dateStr = dateCode
        ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
        : "";
      const photographer = sourceMap[srcCode] || srcCode || "ABC News";
      const baseUrl = url.replace(/\?.*$/, "");
      return {
        id: 200000 + i,
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
  } catch {
    return null;
  }
}

// ============ 主入口 ============
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const newsKey = ctx.env.NEWSAPI_KEY;
  const kv = ctx.env.GALLERY_CACHE;

  const headers = { "Content-Type": "application/json" };

  // 策略 0: KV 缓存（超过 24h 自动后台刷新）
  if (kv) {
    const cached = await fetchFromKV(kv);
    if (cached) {
      const age = Date.now() - new Date(cached.collectedAt).getTime();
      const isStale = age > KV_TTL_MS;

      // KV 过期 → 后台异步刷新（不阻塞当前响应）
      if (isStale) {
        ctx.waitUntil(bgRefreshKV(kv));
      }

      const start = (page - 1) * PER_PAGE;
      const slice = cached.photos.slice(start, start + PER_PAGE);
      return new Response(JSON.stringify({
        photos: slice,
        next_page: start + PER_PAGE < cached.photos.length ? String(page + 1) : undefined,
        source: "abcnews",
        collectedAt: cached.collectedAt,
        stale: isStale,
      }), {
        headers: {
          ...headers,
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }
  }

  // 策略 1: NewsAPI 真实新闻照片
  if (newsKey) {
    const photos = await fetchNewsApi(newsKey, page);
    if (photos) {
      return new Response(JSON.stringify({
        photos,
        next_page: photos.length >= PER_PAGE ? String(page + 1) : undefined,
        source: "newsapi",
      }), {
        headers: {
          ...headers,
          "Cache-Control": "public, max-age=1800, s-maxage=1800",
        },
      });
    }
  }

  // 策略 2: ABC News 比赛图集（无需 Key，专业体育摄影照片）
  const abcPhotos = await fetchAbcNews();
  if (abcPhotos) {
    const start = (page - 1) * PER_PAGE;
    const slice = abcPhotos.slice(start, start + PER_PAGE);
    return new Response(JSON.stringify({
      photos: slice,
      next_page: start + PER_PAGE < abcPhotos.length ? String(page + 1) : undefined,
      source: "abcnews",
    }), {
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  return new Response(JSON.stringify({ error: "所有图片源暂时不可用" }), {
    status: 502,
    headers,
  });
};
