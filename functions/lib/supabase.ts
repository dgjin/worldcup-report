import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchRaw } from "../../src/types/worldcup";

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

/** upsert 比赛列表到 wc_matches（收费 API 直接含 goals，无需保留逻辑） */
export async function writeWcMatches(
  sb: SupabaseClient,
  matches: MatchRaw[],
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

  if (rows.length > 0) {
    await sb.from("wc_matches").upsert(rows, { onConflict: "id" });
  }
  await sb.from("wc_sync_meta").upsert(
    { type: "matches", last_sync_at: new Date().toISOString(), source },
    { onConflict: "type" },
  );
}
