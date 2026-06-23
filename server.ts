import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 加载 .env（Node 20.12+ 内置，无需 dotenv 依赖）
try {
  process.loadEnvFile();
} catch {
  /* 没有 .env 文件，使用快照即可 */
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5273;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN?.trim();
const isProd = process.env.NODE_ENV === "production";

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";
const ENDPOINTS: Record<string, string> = {
  standings: `${FD_BASE}/standings`,
  scorers: `${FD_BASE}/scorers?limit=30`,
  matches: `${FD_BASE}/matches`,
  teams: `${FD_BASE}/teams`,
};
const CACHE_TTL = 60_000; // 60s，守住免费档 10 次/分钟限流

type Entry = { ts: number; data: unknown; source: "live" | "snapshot" };
const cache = new Map<string, Entry>();

/** 球队名称归一化 */
function normTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[- ]/g, "")
    .replace(/bosnia.*?herzegovina/g, "bosnia")
    .replace(/southkorea/g, "korea")
    .replace(/^korea.*/, "korea")
    .replace(/côte.*/, "ivorycoast")
    .replace(/ivoorkust/, "ivorycoast")
    .replace(/trinidad.*/, "trinidad")
    .replace(/unitedstates.*/, "usa")
    .replace(/deutschland/, "germany")
    .replace(/brasil/, "brazil")
    .replace(/españa/, "spain")
    .replace(/türkiye/, "turkiye")
    .replace(/curacao/, "curacao");
}

function matchKey(home: string, away: string): string {
  return `${normTeam(home)}|${normTeam(away)}`;
}

/** 从快照构建 "home|away" -> goals[] 查找表 */
function buildGoalsLookup(snap: any): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>();
  const snapMatches = snap.matches?.matches;
  if (!snapMatches) return map;
  for (const m of snapMatches) {
    if (m.goals && m.goals.length > 0) {
      const key = matchKey(m.homeTeam.name, m.awayTeam.name);
      map.set(key, m.goals);
    }
  }
  return map;
}

/** 用快照进球数据富化 live 比赛 */
function injectSnapshotGoals(matches: any[], lookup: Map<string, unknown[]>) {
  for (const m of matches) {
    if (m.status === "FINISHED" && !m.goals?.length) {
      const key = matchKey(m.homeTeam.name, m.awayTeam.name);
      const goals = lookup.get(key);
      if (goals) m.goals = goals;
    }
  }
}

const snapshot = JSON.parse(readFileSync(join(__dirname, "data/snapshot.json"), "utf-8")) as Record<string, unknown> & {
  _meta: { asOf: string };
};
const goalsLookup = buildGoalsLookup(snapshot);

async function getData(key: string): Promise<Entry> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit;

  if (TOKEN) {
    try {
      const res = await fetch(ENDPOINTS[key], { headers: { "X-Auth-Token": TOKEN } });
      if (res.ok) {
        const data = await res.json();
        // 对 matches 端点用快照进球数据富化
        if (key === "matches" && data.matches) {
          injectSnapshotGoals(data.matches, goalsLookup);
        }
        const entry: Entry = { ts: Date.now(), data, source: "live" };
        cache.set(key, entry);
        return entry;
      }
      console.warn(`[wc] football-data ${key} 返回 ${res.status}，回退快照`);
    } catch (e) {
      console.warn(`[wc] football-data ${key} 请求失败，回退快照：`, (e as Error).message);
    }
  }
  return { ts: Date.now(), data: snapshot[key], source: "snapshot" };
}

async function start() {
  const app = express();

  for (const key of Object.keys(ENDPOINTS)) {
    app.get(`/api/wc/${key}`, async (_req, res) => {
      const { data, source } = await getData(key);
      res.set("X-Data-Source", source);
      res.set("Cache-Control", "no-store");
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
    const mode = TOKEN ? "football-data API（+快照兜底）" : "快照 snapshot（未配置 token）";
    console.log(`\n  ▶ 2026 世界杯战报  http://localhost:${PORT}`);
    console.log(`     数据源：${mode}\n`);
  });
}

start();
