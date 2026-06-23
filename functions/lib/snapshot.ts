import snapshot from "../../data/snapshot.json";

const SNAP = snapshot as Record<string, unknown> & { _meta: { asof: string } };

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";

export type WcType = "standings" | "scorers" | "matches" | "teams";

const PATHS: Record<WcType, string> = {
  standings: "/standings",
  scorers: "/scorers?limit=30",
  matches: "/matches",
  teams: "/teams",
};

/** 球队名称归一化（处理 live API 与快照名称差异） */
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
    .replace(/^usa$/, "usa")
    .replace(/deutschland/, "germany")
    .replace(/brasil/, "brazil")
    .replace(/españa/, "spain")
    .replace(/türkiye/, "turkiye")
    .replace(/curacao/, "curacao");
}

/** 生成比赛 key（仅球队名对，排序后去重） */
function matchKey(home: string, away: string): string {
  const h = normTeam(home);
  const a = normTeam(away);
  return `${h}|${a}`;
}

/** 从快照构建 "home|away" -> goals[] 查找表 */
function buildGoalsLookup(): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>();
  const snapMatches = (SNAP.matches as any)?.matches as any[] | undefined;
  if (!snapMatches) return map;
  for (const m of snapMatches) {
    if (m.goals && m.goals.length > 0) {
      const key = matchKey(m.homeTeam.name, m.awayTeam.name);
      map.set(key, m.goals);
    }
  }
  return map;
}

const goalsLookup = buildGoalsLookup();

/** 用快照进球数据富化 live 比赛（按球队对匹配） */
function injectSnapshotGoals(matches: any[]) {
  for (const m of matches) {
    if (m.status === "FINISHED" && !m.goals?.length) {
      const key = matchKey(m.homeTeam.name, m.awayTeam.name);
      const goals = goalsLookup.get(key);
      if (goals) m.goals = goals;
    }
  }
}

export async function getWcData(type: WcType, token?: string) {
  if (token) {
    try {
      const res = await fetch(FD_BASE + PATHS[type], { headers: { "X-Auth-Token": token } });
      if (res.ok) {
        const data = await res.json();
        if (type === "matches" && data.matches) {
          injectSnapshotGoals(data.matches);
        }
        return { data, source: "live" as const };
      }
    } catch {}
  }
  const fallback = SNAP[type] ?? (type === "teams" ? { teams: [] } : null);
  return { data: fallback, source: "snapshot" as const };
}

export function toJson(data: unknown, source: "live" | "snapshot", maxAge?: number) {
  const cacheControl =
    maxAge != null
      ? `public, max-age=${maxAge}`
      : source === "live"
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=3600";
  return new Response(JSON.stringify({
    ...(data as object),
    _source: source,
    _asOf: source === "snapshot" ? (SNAP._meta as any).asOf ?? (SNAP._meta as any).asof : new Date().toISOString(),
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "X-Data-Source": source,
      "Pragma": source === "live" ? "no-cache" : "",
    },
  });
}
