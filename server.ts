import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClient as createSbClient,
  readWcData,
  readWcMatches,
  writeWcData,
  writeWcMatches,
  injectSupabaseGoals,
} from "./functions/lib/supabase.js";
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
const isProd = process.env.NODE_ENV === "production";

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";
const ENDPOINTS: Record<string, string> = {
  standings: `${FD_BASE}/standings`,
  scorers: `${FD_BASE}/scorers?limit=30`,
  matches: `${FD_BASE}/matches`,
  teams: `${FD_BASE}/teams`,
};
const CACHE_TTL = 60_000;

type Source = "live" | "supabase" | "snapshot";
type Entry = { ts: number; data: unknown; source: Source };
const cache = new Map<string, Entry>();

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

const snapshot = JSON.parse(readFileSync(join(__dirname, "data/snapshot.json"), "utf-8")) as Record<string, unknown> & {
  _meta: { asOf: string };
};

async function getData(key: string): Promise<Entry> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit;

  // 1. 尝试 live API
  if (TOKEN) {
    try {
      const res = await fetch(ENDPOINTS[key], { headers: { "X-Auth-Token": TOKEN } });
      if (res.ok) {
        const data = await res.json();
        // 对 matches 用 Supabase goals 富化
        if (key === "matches" && data.matches) {
          const client = getSb();
          if (client) {
            try { await injectSupabaseGoals(client, data.matches); } catch {}
          }
        }
        // fire-and-forget 写入 Supabase
        const client = getSb();
        if (client) {
          if (key === "matches" && data.matches) {
            writeWcMatches(client, data.matches, "live").catch(() => {});
          } else if (key !== "matches") {
            writeWcData(client, key as "standings" | "scorers" | "teams", data, "live").catch(() => {});
          }
        }
        const entry: Entry = { ts: Date.now(), data, source: "live" };
        cache.set(key, entry);
        return entry;
      }
      console.warn(`[wc] football-data ${key} 返回 ${res.status}，回退`);
    } catch (e) {
      console.warn(`[wc] football-data ${key} 请求失败：`, (e as Error).message);
    }
  }

  // 2. 尝试 Supabase
  const client = getSb();
  if (client) {
    try {
      if (key === "matches") {
        const result = await readWcMatches(client);
        if (result && result.matches.length > 0) {
          const entry: Entry = { ts: Date.now(), data: { matches: result.matches }, source: "supabase" };
          cache.set(key, entry);
          return entry;
        }
      } else {
        const result = await readWcData(client, key as "standings" | "scorers" | "teams");
        if (result) {
          const entry: Entry = { ts: Date.now(), data: result.data, source: "supabase" };
          cache.set(key, entry);
          return entry;
        }
      }
    } catch (e) {
      console.warn(`[wc] Supabase ${key} 读取失败：`, (e as Error).message);
    }
  }

  // 3. 兜底 snapshot.json
  return { ts: Date.now(), data: snapshot[key], source: "snapshot" };
}

async function start() {
  const app = express();

  for (const key of Object.keys(ENDPOINTS)) {
    app.get(`/api/wc/${key}`, async (_req, res) => {
      const { data, source } = await getData(key);
      const cacheControl =
        source === "live" ? "no-store"
        : source === "supabase" ? "public, max-age=120"
        : "public, max-age=3600";
      res.set("X-Data-Source", source);
      res.set("Cache-Control", cacheControl);
      res.json({
        ...(data as object),
        _source: source,
        _asOf: source === "snapshot" ? snapshot._meta.asOf : new Date().toISOString(),
      });
    });
  }

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
    const modes = [];
    if (TOKEN) modes.push("live API");
    if (SB_URL) modes.push("Supabase");
    modes.push("snapshot");
    console.log(`\n  ▶ 2026 世界杯战报  http://localhost:${PORT}`);
    console.log(`     数据源：${modes.join(" → ")}\n`);
  });
}

start();
