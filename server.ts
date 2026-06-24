import express from "express";
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
const isProd = process.env.NODE_ENV === "production";

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";
const ENDPOINTS: Record<WcDataType, string> = {
  standings: `${FD_BASE}/standings`,
  scorers: `${FD_BASE}/scorers?limit=30`,
  matches: `${FD_BASE}/matches`,
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
