import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

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

/** upsert 比赛列表到 wc_matches */
export async function writeWcMatches(
  sb: SupabaseClient,
  matches: any[],
  source: "live" | "snapshot",
): Promise<void> {
  const rows = matches.map((m) => ({
    id: m.id,
    data: m,
    home_team: m.homeTeam?.name ?? "",
    away_team: m.awayTeam?.name ?? "",
    status: m.status ?? "TIMED",
    utc_date: m.utcDate ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  // 分批 upsert（Supabase 单次上限 ~1000 行，这里远不够）
  if (rows.length > 0) {
    await sb.from("wc_matches").upsert(rows, { onConflict: "id" });
  }
  await sb.from("wc_sync_meta").upsert(
    { type: "matches", last_sync_at: new Date().toISOString(), source },
    { onConflict: "type" },
  );
}

// ---- Goals 注入 ----

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
    .replace(/deutschland/, "germany")
    .replace(/brasil/, "brazil")
    .replace(/españa/, "spain")
    .replace(/türkiye/, "turkiye")
    .replace(/curacao/, "curacao");
}

function matchKey(home: string, away: string): string {
  return `${normTeam(home)}|${normTeam(away)}`;
}

/** 用 Supabase 中已存储的 goals 数据富化 live 比赛 */
export async function injectSupabaseGoals(
  sb: SupabaseClient,
  matches: any[],
): Promise<void> {
  // 找出需要补充 goals 的已完赛比赛
  const needGoals = matches.filter(
    (m) => m.status === "FINISHED" && !m.goals?.length,
  );
  if (needGoals.length === 0) return;

  // 策略1: 按 match ID 匹配（live API 同步写入时 ID 一致）
  const matchIds = needGoals.map((m) => m.id);
  const { data: rows } = await sb
    .from("wc_matches")
    .select("id, data")
    .in("id", matchIds);

  if (rows && rows.length > 0) {
    // 构建 id -> goals 查找表
    const goalsMap = new Map<number, any[]>();
    for (const row of rows) {
      const goals = (row.data as any)?.goals;
      if (goals && goals.length > 0) {
        goalsMap.set(row.id, goals);
      }
    }
    // 注入（ID 匹配成功的）
    for (const m of needGoals) {
      const goals = goalsMap.get(m.id);
      if (goals) m.goals = goals;
    }
  }

  // 策略2: ID 未匹配的，按球队名对匹配（快照 ID 1001-1072 vs live ID 537xxx）
  const stillNeedGoals = needGoals.filter((m) => !m.goals?.length);
  if (stillNeedGoals.length === 0) return;

  // 查询所有有 goals 数据的 FINISHED 比赛
  const { data: goalRows } = await sb
    .from("wc_matches")
    .select("home_team, away_team, data")
    .eq("status", "FINISHED");

  if (!goalRows || goalRows.length === 0) return;

  // 构建 teamKey -> goals 查找表
  const teamGoalsMap = new Map<string, any[]>();
  for (const row of goalRows) {
    const goals = (row.data as any)?.goals;
    if (goals && goals.length > 0) {
      const key = matchKey(row.home_team, row.away_team);
      teamGoalsMap.set(key, goals);
    }
  }

  // 按球队名注入
  for (const m of stillNeedGoals) {
    const key = matchKey(m.homeTeam?.name ?? "", m.awayTeam?.name ?? "");
    const goals = teamGoalsMap.get(key);
    if (goals) m.goals = goals;
  }
}
