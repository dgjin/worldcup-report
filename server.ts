import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClient as createSbClient,
  writeWcData,
  writeWcMatches,
  type WcDataType,
} from "./functions/lib/supabase.js";
import { getWcData, toJson } from "./functions/lib/snapshot.js";
import type { MatchRaw } from "./src/types/worldcup";
import type { SupabaseClient } from "@supabase/supabase-js";

// 加载 .env
try {
  process.loadEnvFile();
} catch {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5273;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN?.trim();
const SB_URL = process.env.SUPABASE_URL?.trim();
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SYNC_SECRET = process.env.SYNC_SECRET?.trim();
const NEWSAPI_KEY = process.env.NEWSAPI_KEY?.trim();
const isProd = process.env.NODE_ENV === "production";

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";
const ENDPOINTS: Record<WcDataType, string> = {
  standings: `${FD_BASE}/standings`,
  scorers: `${FD_BASE}/scorers?limit=30`,
  matches: `${FD_BASE}/matches?dateFrom=2026-06-10&dateTo=2026-07-20`,
  teams: `${FD_BASE}/teams`,
};
const CACHE_TTL = 60_000;

type Source = "live" | "supabase" | "snapshot";
type Entry = { ts: number; data: unknown; source: Source };
const cache = new Map<WcDataType, Entry>();

// Supabase 客户端（懒初始化）
let sb: SupabaseClient | null = null;
function getSb(): SupabaseClient | null {
  if (sb || !SB_URL || !SB_KEY) return sb;
  try {
    sb = createSbClient(SB_URL, SB_KEY);
    return sb;
  } catch {
    return null;
  }
}

/** 鉴权校验：通过返回 null，未通过返回 true（并发送 401） */
function authSync(req: express.Request, res: express.Response): boolean {
  const secret = (req.query.secret as string) ?? req.get("X-Sync-Secret") ?? "";
  if (SYNC_SECRET && secret !== SYNC_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return true;
  }
  return false;
}

async function start() {
  const app = express();
  app.use(express.json()); // 解析 JSON 请求体（投票/点赞/留言等 POST 路由依赖）

  for (const key of Object.keys(ENDPOINTS) as WcDataType[]) {
    app.get(`/api/wc/${key}`, async (_req, res) => {
      // 本地内存缓存，避免开发时频繁打外部 API
      const hit = cache.get(key);
      if (hit && Date.now() - hit.ts < CACHE_TTL) {
        const body = await toJson(hit.data, hit.source, key === "teams" ? 21600 : undefined);
        const json = await body.json();
        res.json(json);
        return;
      }
      const sbConfig =
        SB_URL && SB_KEY ? { url: SB_URL, key: SB_KEY } : undefined;
      const { data, source } = await getWcData(key, TOKEN, sbConfig);
      if (!data) {
        res.status(502).json({ error: "No data" });
        return;
      }
      cache.set(key, { ts: Date.now(), data, source });
      const body = toJson(data, source, key === "teams" ? 21600 : undefined);
      res.set("X-Data-Source", source);
      res.set("Cache-Control", body.headers.get("Cache-Control") ?? "no-store");
      res.json(await body.json());
    });
  }

  // 同步端点
  app.post("/api/sync", async (req, res) => {
    if (authSync(req, res)) return;
    if (!TOKEN) {
      res.status(500).json({ error: "No FOOTBALL_DATA_TOKEN" });
      return;
    }
    const client = getSb();
    if (!client) {
      res.status(500).json({ error: "Supabase not configured" });
      return;
    }
    const results: Record<string, string> = {};
    for (const [key, url] of Object.entries(ENDPOINTS) as [WcDataType, string][]) {
      try {
        const r = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
        if (!r.ok) { results[key] = `API ${r.status}`; continue; }
        const d = (await r.json()) as Record<string, unknown>;
        if (key === "matches" && d.matches) {
          const matches = d.matches as MatchRaw[];
          await writeWcMatches(client, matches, "live");
          results[key] = `${matches.length} synced`;
        } else {
          await writeWcData(client, key as "standings" | "scorers" | "teams", d, "live");
          const count = Array.isArray(d[key]) ? (d[key] as unknown[]).length : 0;
          results[key] = `${count} synced`;
        }
        // 清除缓存，强制下次请求读最新数据
        cache.delete(key);
      } catch (e) {
        results[key] = `Error: ${(e as Error).message}`;
      }
    }
    res.json({ ok: true, results, syncedAt: new Date().toISOString() });
  });

  app.get("/api/sync", async (req, res) => {
    if (authSync(req, res)) return;
    const client = getSb();
    if (!client) { res.status(500).json({ error: "Supabase not configured" }); return; }
    const { data: meta } = await client.from("wc_sync_meta").select("*");
    res.json({ syncMeta: meta });
  });

  // 精彩瞬间照片（NewsAPI 新闻照 → ABC News 比赛图集 → USA Today → AP News）
  const ABC_GALLERY_URL = "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";
  const USATODAY_GALLERY_URL = "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";
  const APNEWS_GALLERY_URLS = [
    "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
    "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
    "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
    "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
    "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
  ];
  const NEWS_QUERIES = [
    "World+Cup+2026+football+match",
    "FIFA+World+Cup+USA+Mexico+Canada+soccer",
    "World+Cup+2026+goal+celebration+stadium",
    "世界杯+2026+足球+比赛",
  ];

  type GalleryPhoto = { id: number; src: { large: string; medium: string; small: string }; photographer: string; alt: string; width: number; height: number; url: string };

  // 图集 HTML 缓存（10 分钟）
  let abcCache: { ts: number; photos: GalleryPhoto[] } | null = null;
  let usaCache: { ts: number; photos: GalleryPhoto[] } | null = null;
  let apCache: { ts: number; photos: GalleryPhoto[] } | null = null;

  /** 从 ABC News 图集页面提取照片 */
  async function tryAbcNews(): Promise<GalleryPhoto[] | null> {
    // 命中缓存
    if (abcCache && Date.now() - abcCache.ts < 600_000) {
      return abcCache.photos;
    }
    try {
      const r = await fetch(ABC_GALLERY_URL);
      if (!r.ok) return null;
      const html = await r.text();

      // 提取 i.abcnewsfe.com 世界杯图片，去重（取 wc- 前缀，排除翻页箭头、广告等）
      const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
      const seen = new Set<string>();
      const matches: string[] = [];
      for (const m of html.matchAll(imgRE)) {
        const name = m[1].replace(/\?.*$/, "");
        if (!seen.has(name)) { seen.add(name); matches.push(m[0].replace(/\?.*$/, "")); }
      }

      if (matches.length === 0) return null;

      const sourceMap: Record<string, string> = {
        gty: "Getty Images", rt: "Reuters", ap: "Associated Press",
      };

      const photos: GalleryPhoto[] = matches.map((url, i) => {
        // 从文件名解析元数据
        const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
        const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
        const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
        const dateStr = dateCode
          ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
          : "";
        const photographer = sourceMap[srcCode] || srcCode || "ABC News";
        // 生成多种尺寸
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
          width: 1600, height: 1067,
          url: ABC_GALLERY_URL,
        };
      });

      abcCache = { ts: Date.now(), photos };
      return photos;
    } catch {
      return null;
    }
  }

  /** 从 USA Today 图集页面提取照片 */
  async function tryUsaToday(): Promise<GalleryPhoto[] | null> {
    if (usaCache && Date.now() - usaCache.ts < 600_000) return usaCache.photos;
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

      const photos: GalleryPhoto[] = urls.map((url, i) => {
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

      usaCache = { ts: Date.now(), photos };
      return photos;
    } catch {
      return null;
    }
  }

  /** 从 AP News 多个图集页面提取照片 */
  async function tryApNews(): Promise<GalleryPhoto[] | null> {
    if (apCache && Date.now() - apCache.ts < 600_000) return apCache.photos;
    try {
      const allPhotos: GalleryPhoto[] = [];

      for (const galleryUrl of APNEWS_GALLERY_URLS) {
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
      }

      if (allPhotos.length === 0) return null;

      const dedupSeen = new Set<string>();
      const unique = allPhotos.filter(p => { const k = p.src.medium; if (dedupSeen.has(k)) return false; dedupSeen.add(k); return true; });

      apCache = { ts: Date.now(), photos: unique };
      return unique;
    } catch {
      return null;
    }
  }

  // 本地 JSON 缓存（由 scripts/collect-gallery.mjs 生成）
  function loadLocalCache(): { photos: GalleryPhoto[]; collectedAt: string } | null {
    try {
      const cachePath = join(__dirname, "data", "gallery-collected.json");
      if (!existsSync(cachePath)) return null;
      const raw = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (!raw.photos || raw.photos.length === 0) return null;
      return raw;
    } catch {
      return null;
    }
  }

  app.get("/api/wc/gallery", async (req, res) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const perPage = 24;

    // 策略 0: 本地 JSON 缓存（脚本每日收集，最快最稳定）
    const local = loadLocalCache();
    if (local) {
      const start = (page - 1) * perPage;
      const slice = local.photos.slice(start, start + perPage);
      res.set("Cache-Control", "public, max-age=3600");
      res.json({
        photos: slice,
        next_page: start + perPage < local.photos.length ? String(page + 1) : undefined,
        source: "abcnews",
        collectedAt: local.collectedAt,
      });
      return;
    }

    // 策略 1: NewsAPI 真实新闻照片
    if (NEWSAPI_KEY) {
      const q = NEWS_QUERIES[(page - 1) % NEWS_QUERIES.length];
      try {
        const r = await fetch(
          `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&language=en&pageSize=24&page=1&apiKey=${NEWSAPI_KEY}`,
        );
        if (r.ok) {
          const d = await r.json() as { articles?: { title: string; urlToImage: string | null; url: string; source: { name: string }; publishedAt: string }[] };
          const articles = (d.articles ?? []).filter(a => a.urlToImage);
          if (articles.length > 0) {
            const photos: GalleryPhoto[] = articles.map((a, i) => ({
              id: page * 10000 + i,
              src: { large: a.urlToImage!, medium: a.urlToImage!, small: a.urlToImage! },
              photographer: a.source.name,
              alt: a.title || "World Cup 2026",
              width: 1200, height: 675,
              url: a.url,
            }));
            res.set("Cache-Control", "public, max-age=1800");
            res.json({ photos, next_page: photos.length >= 24 ? String(page + 1) : undefined, source: "newsapi" });
            return;
          }
        }
      } catch {}
    }

    // 策略 2: ABC News 最佳比赛图集（无需 Key，68 张专业赛事照片）
    const abcPhotos = await tryAbcNews();
    if (abcPhotos) {
      const start = (page - 1) * perPage;
      const slice = abcPhotos.slice(start, start + perPage);
      res.set("Cache-Control", "public, max-age=3600");
      res.json({
        photos: slice,
        next_page: start + perPage < abcPhotos.length ? String(page + 1) : undefined,
        source: "abcnews",
      });
      return;
    }

    // 策略 3: USA Today 每日比赛图集（无需 Key，Getty/USA Today Staff 供图）
    const usaPhotos = await tryUsaToday();
    if (usaPhotos) {
      const start = (page - 1) * perPage;
      const slice = usaPhotos.slice(start, start + perPage);
      res.set("Cache-Control", "public, max-age=3600");
      res.json({
        photos: slice,
        next_page: start + perPage < usaPhotos.length ? String(page + 1) : undefined,
        source: "usatoday",
      });
      return;
    }

    // 策略 4: AP News 每日精选图集（无需 Key，AP Photo 专业摄影师）
    const apPhotos = await tryApNews();
    if (apPhotos) {
      const start = (page - 1) * perPage;
      const slice = apPhotos.slice(start, start + perPage);
      res.set("Cache-Control", "public, max-age=3600");
      res.json({
        photos: slice,
        next_page: start + perPage < apPhotos.length ? String(page + 1) : undefined,
        source: "apnews",
      });
      return;
    }

    res.status(502).json({ error: "所有图片源暂时不可用" });
  });

  // ====== 精彩瞬间手动刷新 API ======
  app.post("/api/wc/gallery/refresh", async (_req, res) => {
    try {
      // 清除缓存
      abcCache = null; usaCache = null; apCache = null;

      const [abcPhotos, usaPhotos, apPhotos] = await Promise.all([
        tryAbcNews().catch(() => null),
        tryUsaToday().catch(() => null),
        tryApNews().catch(() => null),
      ]);

      const abcCount = abcPhotos?.length ?? 0;
      const usaCount = usaPhotos?.length ?? 0;
      const apCount = apPhotos?.length ?? 0;

      // 合并去重，得到本次完整图集（以 src.medium 为唯一 key）
      const all: GalleryPhoto[] = [];
      if (abcPhotos) all.push(...abcPhotos);
      if (usaPhotos) all.push(...usaPhotos);
      if (apPhotos) all.push(...apPhotos);
      const seen = new Set<string>();
      const current = all.filter(p => { const k = p.src.medium; if (seen.has(k)) return false; seen.add(k); return true; });
      const total = current.length;

      if (total === 0) {
        res.status(502).json({ ok: false, error: "未能从任何来源获取到图片" });
        return;
      }

      // 相比「上次」（本地 JSON 缓存）识别新增，并把新增排在最前面
      const prev = loadLocalCache();
      const prevKeys = new Set((prev?.photos ?? []).map(p => p.src.medium));
      const newOnes = current.filter(p => !prevKeys.has(p.src.medium));
      const existing = current.filter(p => prevKeys.has(p.src.medium));
      const ordered = [...newOnes, ...existing];
      const added = prev ? newOnes.length : total;

      res.json({
        ok: true,
        message: added > 0 ? `新增 ${added} 张照片` : "图片已是最新",
        collectedAt: new Date().toISOString(),
        results: { abcnews: abcCount, usatoday: usaCount, apnews: apCount },
        photos: ordered,
        source: "merged",
        total,
        added,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  // ====== 照片点赞 API ======

  app.get("/api/wc/gallery/likes", async (_req, res) => {
    const sb = getSb();
    if (!sb) { res.json({}); return; }
    try {
      const { data } = await sb.from("gallery_likes").select("photo_key,likes");
      const map: Record<string, number> = {};
      for (const r of (data ?? [])) map[r.photo_key] = r.likes;
      res.set("Cache-Control", "public, max-age=30");
      res.json(map);
    } catch (e) {
      console.error("[likes GET]", (e as Error).message);
      res.json({});
    }
  });

  app.post("/api/wc/gallery/likes", async (req, res) => {
    const sb = getSb();
    const pk = req.body?.photoKey;
    if (!sb || !pk) { res.status(400).json({ error: !sb ? "Supabase not configured" : "缺少 photoKey" }); return; }
    try {
      const { data: row } = await sb.from("gallery_likes").select("likes").eq("photo_key", pk).maybeSingle();
      const current = row?.likes ?? 0;
      if (row) {
        await sb.from("gallery_likes").update({ likes: current + 1 }).eq("photo_key", pk);
      } else {
        await sb.from("gallery_likes").upsert({ photo_key: pk, likes: 1 }, { onConflict: "photo_key", ignoreDuplicates: false });
      }
      res.json({ photoKey: pk, likes: current + 1 });
    } catch (e) {
      console.error("[likes POST]", (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  });
  // ====== 照片点赞 API END ======

  // ====== 访问计数 API ======

  const VISITS_KEY = "__visits__";
  const VISITS_SEED = 326;

  app.get("/api/app/visits", async (_req, res) => {
    const sb = getSb();
    if (!sb) { res.json({ visits: VISITS_SEED }); return; }
    try {
      const { data: row } = await sb.from("gallery_likes").select("likes").eq("photo_key", VISITS_KEY).maybeSingle();
      if (!row) {
        await sb.from("gallery_likes").upsert({ photo_key: VISITS_KEY, likes: VISITS_SEED }, { onConflict: "photo_key", ignoreDuplicates: false });
        res.json({ visits: VISITS_SEED });
        return;
      }
      if (row.likes < VISITS_SEED) {
        await sb.from("gallery_likes").update({ likes: VISITS_SEED }).eq("photo_key", VISITS_KEY);
        res.json({ visits: VISITS_SEED });
        return;
      }
      res.set("Cache-Control", "public, max-age=15");
      res.json({ visits: row.likes });
    } catch (e) {
      console.error("[visits GET]", (e as Error).message);
      res.json({ visits: VISITS_SEED });
    }
  });

  app.post("/api/app/visits", async (_req, res) => {
    const sb = getSb();
    if (!sb) { res.status(500).json({ error: "Supabase not configured" }); return; }
    try {
      const { data: row } = await sb.from("gallery_likes").select("likes").eq("photo_key", VISITS_KEY).maybeSingle();
      const current = row?.likes ?? VISITS_SEED;
      if (row) {
        await sb.from("gallery_likes").update({ likes: current + 1 }).eq("photo_key", VISITS_KEY);
      } else {
        await sb.from("gallery_likes").upsert({ photo_key: VISITS_KEY, likes: VISITS_SEED + 1 }, { onConflict: "photo_key", ignoreDuplicates: false });
      }
      res.json({ visits: current + 1 });
    } catch (e) {
      console.error("[visits POST]", (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ====== 访问计数 API END ======

  // ====== 冠军投票 API ======

  app.get("/api/app/vote", async (req, res) => {
    const sb = getSb();
    if (!sb) { res.json({ champion: {}, runnerup: {}, thirdplace: {}, total: 0, voters: 0 }); return; }
    try {
      const { data } = await sb.from("gallery_likes").select("photo_key,likes");
      const result = { champion: {} as Record<string, number>, runnerup: {} as Record<string, number>, thirdplace: {} as Record<string, number> };
      for (const row of (data ?? [])) {
        const parts = (row.photo_key as string).split("_");
        if (parts.length < 3 || parts[0] !== "vote") continue;
        const cat = parts[1] as "champion" | "runnerup" | "thirdplace";
        const team = parts.slice(2).join("_");
        if (cat in result) result[cat][team] = row.likes;
      }
      const total = Object.values(result).reduce((s, cat) => s + Object.values(cat).reduce((a, b) => a + b, 0), 0);
      // 读取个人投票记录数
      let voters = 0;
      try {
        const { count } = await sb.from("wc_data").select("id", { count: "exact", head: true }).like("type", "vote_record_%");
        voters = count ?? 0;
      } catch { /* ignore */ }
      const response: Record<string, unknown> = { ...result, total, voters };
      // 如果提供了 email，查找该用户的投票记录
      const email = (req.query.email as string)?.trim();
      if (email) {
        try {
          const { data: records } = await sb.from("wc_data").select("data").like("type", "vote_record_%");
          for (const row of (records ?? [])) {
            if (row.data?.email?.toLowerCase() === email.toLowerCase()) {
              response.myRecord = row.data;
              break;
            }
          }
        } catch { /* ignore */ }
      }
      // 投票详情（需密码）：?detail=密码
      const detail = req.query.detail as string | undefined;
      if (detail != null) {
        const pw = process.env.VOTE_DETAIL_PASSWORD;
        if (!pw || detail !== pw) { res.status(403).json({ error: "密码错误" }); return; }
        try {
          const { data: recs } = await sb.from("wc_data").select("data").like("type", "vote_record_%");
          response.records = (recs ?? [])
            .map((r: { data?: { ts?: string } }) => r.data)
            .filter((d): d is { ts?: string } => Boolean(d))
            .sort((a, b) => String(b.ts ?? "").localeCompare(String(a.ts ?? "")));
        } catch { response.records = []; }
        res.set("Cache-Control", "no-store");
        res.json(response);
        return;
      }
      res.set("Cache-Control", "public, max-age=15");
      res.json(response);
    } catch (e) {
      console.error("[vote GET]", (e as Error).message);
      res.json({ champion: {}, runnerup: {}, thirdplace: {}, total: 0, voters: 0 });
    }
  });

  app.post("/api/app/vote", async (req, res) => {
    const sb = getSb();
    if (!sb) { res.status(500).json({ error: "Supabase not configured" }); return; }
    const { champion, runnerup, thirdplace, email, name } = req.body ?? {};
    const picks = [
      { cat: "champion", team: champion },
      { cat: "runnerup", team: runnerup },
      { cat: "thirdplace", team: thirdplace },
    ].filter((p) => p.team?.trim());

    if (picks.length === 0) { res.status(400).json({ error: "请至少选择一个名次" }); return; }

    try {
      // 1. 存入个人投票记录到 wc_data
      const recordId = `vote_record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const recordData = {
        email: email?.trim() || "",
        name: name?.trim() || "",
        champion: champion?.trim() || "",
        runnerup: runnerup?.trim() || "",
        thirdplace: thirdplace?.trim() || "",
        ts: new Date().toISOString(),
      };
      try {
        await sb.from("wc_data").insert({ type: recordId, data: recordData, source: "user", updated_at: new Date().toISOString() });
      } catch (e) {
        console.error("[vote] record save failed:", (e as Error).message);
      }

      // 2. 更新聚合计数到 gallery_likes
      for (const { cat, team } of picks) {
        const key = `vote_${cat}_${team.trim()}`;
        const { data: row } = await sb.from("gallery_likes").select("likes").eq("photo_key", key).maybeSingle();
        const current = row?.likes ?? 0;
        if (row) {
          await sb.from("gallery_likes").update({ likes: current + 1 }).eq("photo_key", key);
        } else {
          await sb.from("gallery_likes").upsert({ photo_key: key, likes: 1 }, { onConflict: "photo_key", ignoreDuplicates: false });
        }
      }
      // 返回最新数据
      const { data } = await sb.from("gallery_likes").select("photo_key,likes");
      const result = { champion: {} as Record<string, number>, runnerup: {} as Record<string, number>, thirdplace: {} as Record<string, number> };
      for (const row of (data ?? [])) {
        const parts = (row.photo_key as string).split("_");
        if (parts.length < 3 || parts[0] !== "vote") continue;
        const cat = parts[1] as "champion" | "runnerup" | "thirdplace";
        const team = parts.slice(2).join("_");
        if (cat in result) result[cat][team] = row.likes;
      }
      const total = Object.values(result).reduce((s, cat) => s + Object.values(cat).reduce((a, b) => a + b, 0), 0);
      let voters = 0;
      try {
        const { count } = await sb.from("wc_data").select("id", { count: "exact", head: true }).like("type", "vote_record_%");
        voters = count ?? 0;
      } catch { /* ignore */ }
      res.json({ ok: true, ...result, total, voters, record: recordData });
    } catch (e) {
      console.error("[vote POST]", (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ====== 冠军投票 API END ======

  // ====== 球迷交流区 API ======
  app.get("/api/app/messages", async (req, res) => {
    const sb = getSb();
    if (!sb) { res.json({ messages: [] }); return; }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? ""), 10) || 60, 1), 100);
    try {
      const { data } = await sb
        .from("wc_data")
        .select("type,data")
        .like("type", "msg_%")
        .order("type", { ascending: false })
        .limit(limit);
      const messages = (data ?? []).map((r: any) => ({
        id: r.type,
        nickname: (r.data?.nickname ?? "").trim(),
        content: r.data?.content ?? "",
        ts: r.data?.ts ?? "",
      }));
      res.json({ messages });
    } catch (e) {
      console.error("[messages GET]", (e as Error).message);
      res.json({ messages: [] });
    }
  });

  app.post("/api/app/messages", async (req, res) => {
    const sb = getSb();
    if (!sb) { res.status(500).json({ error: "Supabase not configured" }); return; }
    const { content, nickname, anonymous } = req.body ?? {};
    const text = String(content ?? "").trim().slice(0, 140);
    if (!text) { res.status(400).json({ error: "留言内容不能为空" }); return; }
    const nick = anonymous ? "" : String(nickname ?? "").trim().slice(0, 24);
    const ts = new Date().toISOString();
    const type = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await sb.from("wc_data").insert({ type, data: { nickname: nick, content: text, ts }, source: "user", updated_at: ts });
      res.json({ ok: true, message: { id: type, nickname: nick, content: text, ts } });
    } catch (e) {
      console.error("[messages POST]", (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  });
  // ====== 球迷交流区 API END ======

  if (!isProd) {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const clientDir = join(__dirname, "dist/client");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => res.sendFile(join(clientDir, "index.html")));
  }

  app.listen(PORT, () => {
    const modes: string[] = [];
    if (TOKEN) modes.push("live API");
    if (SB_URL) modes.push("Supabase");
    modes.push("snapshot");
    console.log(`\n  ▶ 2026 世界杯战报  http://localhost:${PORT}`);
    console.log(`     数据源：${modes.join(" → ")}\n`);
  });
}

start();
