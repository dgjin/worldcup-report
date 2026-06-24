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

  // 精彩瞬间照片（NewsAPI 新闻照 → ABC News 比赛图集）
  const ABC_GALLERY_URL = "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";
  const NEWS_QUERIES = [
    "World+Cup+2026+football+match",
    "FIFA+World+Cup+USA+Mexico+Canada+soccer",
    "World+Cup+2026+goal+celebration+stadium",
    "世界杯+2026+足球+比赛",
  ];

  type GalleryPhoto = { id: number; src: { large: string; medium: string; small: string }; photographer: string; alt: string; width: number; height: number; url: string };

  // ABC News 图集 HTML 缓存（10 分钟）
  let abcCache: { ts: number; photos: GalleryPhoto[] } | null = null;

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

    res.status(502).json({ error: "所有图片源暂时不可用" });
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
