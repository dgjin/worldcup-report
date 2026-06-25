/**
 * Gallery API endpoint — 2026 美加墨世界杯精彩瞬间。
 *
 * 数据获取策略：
 *   1. KV 缓存（合并所有来源） — Worker 每日 8:00 自动收集
 *   2. NewsAPI        — 真实新闻比赛照片
 *   3. ABC News       — 最佳比赛图集（Reuters/Getty/AP）
 *   4. USA Today      — 每日比赛图集（50+ 张，Getty/USA Today Staff）
 *   5. AP News        — 每日精选图集（AP Photo 专业摄影师）
 *
 * 缓存策略：KV 24h / NewsAPI 30min / ABC News 1h / USA Today 1h / AP News 1h
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
const USATODAY_GALLERY_URL = "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";
const APNEWS_GALLERY_URLS = [
  "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
  "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
  "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
];
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
    const [abcPhotos, usaPhotos, apPhotos] = await Promise.all([
      fetchAbcNews().catch(() => null),
      fetchUsaToday().catch(() => null),
      fetchApNews().catch(() => null),
    ]);

    const allPhotos: GalleryPhoto[] = [];
    if (abcPhotos) allPhotos.push(...abcPhotos);
    if (usaPhotos) allPhotos.push(...usaPhotos);
    if (apPhotos) allPhotos.push(...apPhotos);

    if (allPhotos.length > 0) {
      // 去重
      const seen = new Set<string>();
      const unique = allPhotos.filter(p => {
        const key = p.src.medium;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      await kv.put("latest", JSON.stringify({ photos: unique, collectedAt: new Date().toISOString() }));
      console.log(`[gallery] KV 后台刷新成功，${unique.length} 张照片（ABC+USA+AP）`);
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

// ============ 策略 3: USA Today 图集 ============
async function fetchUsaToday(): Promise<GalleryPhoto[] | null> {
  try {
    const r = await fetch(USATODAY_GALLERY_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!r.ok) return null;
    const html = await r.text();

    const imgRE = /https?:\/\/www\.usatoday\.com\/gcdn\/authoring\/authoring-images\/\d{4}\/\d{2}\/\d{2}\/[A-Z]+\/([^"'\s]+\.jpg)/gi;
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const m of html.matchAll(imgRE)) {
      const base = m[0].split("?")[0];
      if (!seen.has(base)) { seen.add(base); urls.push(base); }
    }

    if (urls.length === 0) return null;

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
  } catch {
    return null;
  }
}

// ============ 策略 4: AP News 每日图集 ============
async function fetchApNews(): Promise<GalleryPhoto[] | null> {
  const allPhotos: GalleryPhoto[] = [];

  for (const galleryUrl of APNEWS_GALLERY_URLS) {
    try {
      const r = await fetch(galleryUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      });
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
    } catch { /* 继续下一个 */ }
  }

  if (allPhotos.length === 0) return null;

  // 去重
  const seen = new Set<string>();
  const unique = allPhotos.filter(p => { const k = p.src.medium; if (seen.has(k)) return false; seen.add(k); return true; });

  return unique;
}
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

  // 策略 3: USA Today 每日比赛图集（无需 Key，Getty/USA Today Staff 供图）
  const usaPhotos = await fetchUsaToday();
  if (usaPhotos) {
    const start = (page - 1) * PER_PAGE;
    const slice = usaPhotos.slice(start, start + PER_PAGE);
    return new Response(JSON.stringify({
      photos: slice,
      next_page: start + PER_PAGE < usaPhotos.length ? String(page + 1) : undefined,
      source: "usatoday",
    }), {
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  // 策略 4: AP News 每日精选图集（无需 Key，AP Photo 专业摄影师）
  const apPhotos = await fetchApNews();
  if (apPhotos) {
    const start = (page - 1) * PER_PAGE;
    const slice = apPhotos.slice(start, start + PER_PAGE);
    return new Response(JSON.stringify({
      photos: slice,
      next_page: start + PER_PAGE < apPhotos.length ? String(page + 1) : undefined,
      source: "apnews",
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
