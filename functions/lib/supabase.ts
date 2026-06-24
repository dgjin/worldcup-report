import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchRaw, MatchGoal } from "../../src/types/worldcup";

export type WcDataType = "standings" | "scorers" | "matches" | "teams";

/** 创建 Supabase 客户端（兼容 Workers + Node.js） */
export function createClient(url: string, key: string): SupabaseClient {
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- 读操作 ----

/** 从 wc_data 读取 standings / scorers / teams */
export async function readWcData(
  sb: SupabaseClient,
  type: "standings" | "scorers" | "teams",
): Promise<{ data: unknown; source: string } | null> {
  const { data, error } = await sb
    .from("wc_data")
    .select("data, source")
    .eq("type", type)
    .single();
  if (error || !data) return null;
  return { data: data.data, source: data.source };
}

/** 从 wc_matches 读取所有比赛，组装为 {matches:[...]} 响应 */
export async function readWcMatches(
  sb: SupabaseClient,
): Promise<{ matches: unknown[]; source: string } | null> {
  const { data, error } = await sb
    .from("wc_matches")
    .select("data")
    .order("utc_date", { ascending: true });
  if (error || !data || data.length === 0) return null;
  const matches = data.map((r: any) => r.data);
  // 取最后更新时间作为 source 判断依据
  const { data: meta } = await sb
    .from("wc_sync_meta")
    .select("source")
    .eq("type", "matches")
    .single();
  return { matches, source: meta?.source ?? "snapshot" };
}

// ---- 写操作（fire-and-forget 友好） ----

/** upsert standings / scorers / teams 到 wc_data */
export async function writeWcData(
  sb: SupabaseClient,
  type: "standings" | "scorers" | "teams",
  data: unknown,
  source: "live" | "snapshot",
): Promise<void> {
  await Promise.all([
    sb.from("wc_data").upsert(
      { type, data, source, updated_at: new Date().toISOString() },
      { onConflict: "type" },
    ),
    sb.from("wc_sync_meta").upsert(
      { type, last_sync_at: new Date().toISOString(), source },
      { onConflict: "type" },
    ),
  ]);
}

/** upsert 比赛列表到 wc_matches（保留已有 goals 数据） */
export async function writeWcMatches(
  sb: SupabaseClient,
  matches: MatchRaw[],
  source: "live" | "snapshot",
): Promise<void> {
  // 查询现有 goals，避免被无 goals 的 live 数据覆盖
  const matchIds = matches.map((m) => m.id);
  const { data: existing } = await sb
    .from("wc_matches")
    .select("id, data")
    .in("id", matchIds);

  const existingGoals = new Map<number, MatchGoal[]>();
  if (existing) {
    for (const row of existing) {
      const goals = (row.data as MatchRaw)?.goals;
      if (goals?.length) existingGoals.set(row.id, goals);
    }
  }

  const rows = matches.map((m) => {
    const prevGoals = existingGoals.get(m.id);
    const mergedData: MatchRaw = (!m.goals?.length && prevGoals)
      ? { ...m, goals: prevGoals }
      : m;
    return {
      id: m.id,
      data: mergedData,
      home_team: m.homeTeam?.name ?? "",
      away_team: m.awayTeam?.name ?? "",
      status: m.status ?? "TIMED",
      utc_date: m.utcDate ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    await sb.from("wc_matches").upsert(rows, { onConflict: "id" });
  }
  await sb.from("wc_sync_meta").upsert(
    { type: "matches", last_sync_at: new Date().toISOString(), source },
    { onConflict: "type" },
  );
}

// ---- Goals 注入 ----

/** 球队名称归一化 */
function normTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[- ]/g, "")
    .replace(/southkorea/g, "korea")
    .replace(/^korea.*/, "korea")
    .replace(/côte.*/, "ivorycoast")
    .replace(/unitedstates.*/, "usa")
    .replace(/brasil/, "brazil")
    .replace(/españa/, "spain")
    .replace(/türkiye/, "turkiye");
}

/** 从 Supabase 中已存储的 goals 数据富化 live 比赛列表 */
export async function injectSupabaseGoals(
  sb: SupabaseClient,
  matches: MatchRaw[],
): Promise<void> {
  const needGoals = matches.filter(
    (m) => m.status === "FINISHED" && !m.goals?.length,
  );
  if (needGoals.length === 0) return;

  // 策略1: 按 match ID 匹配
  const matchIds = needGoals.map((m) => m.id);
  const { data: rows } = await sb
    .from("wc_matches")
    .select("id, data")
    .in("id", matchIds);

  if (rows?.length) {
    const goalsMap = new Map<number, MatchGoal[]>();
    for (const row of rows) {
      const goals = (row.data as MatchRaw)?.goals;
      if (goals?.length) goalsMap.set(row.id, goals);
    }
    for (const m of needGoals) {
      const goals = goalsMap.get(m.id);
      if (goals) m.goals = goals;
    }
  }

  // 策略2: 按球队名对匹配（种子数据 ID 1001-1072 vs live ID 537xxx）
  const stillNeed = needGoals.filter((m) => !m.goals?.length);
  if (stillNeed.length === 0) return;

  const { data: goalRows } = await sb
    .from("wc_matches")
    .select("home_team, away_team, data")
    .eq("status", "FINISHED");

  if (!goalRows?.length) return;

  const teamGoalsMap = new Map<string, MatchGoal[]>();
  for (const row of goalRows) {
    const goals = (row.data as MatchRaw)?.goals;
    if (goals?.length) {
      const key = `${normTeam(row.home_team)}|${normTeam(row.away_team)}`;
      teamGoalsMap.set(key, goals);
    }
  }

  for (const m of stillNeed) {
    const key = `${normTeam(m.homeTeam?.name ?? "")}|${normTeam(m.awayTeam?.name ?? "")}`;
    const goals = teamGoalsMap.get(key);
    if (goals) m.goals = goals;
  }
}
