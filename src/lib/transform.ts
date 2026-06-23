import type {
  GroupTable,
  MatchRaw,
  MatchesResponse,
  ScorerRaw,
  ScorersResponse,
  SplitMatches,
  StandingRow,
  StandingsResponse,
} from "../types/worldcup";

/** "GROUP_A" / "Group A" / "GROUP_L" -> "A" */
export function groupLetter(g: string | null): string {
  if (!g) return "?";
  const m = g.match(/([A-Z])\s*$/i);
  return m ? m[1].toUpperCase() : g;
}

/** 小组赛积分榜：每组一张表，按字母 A..L 排序，组内按官方名次排序 */
export function toGroupTables(res?: StandingsResponse | null): GroupTable[] {
  const groups = (res?.standings ?? []).filter(
    (s) => (s.type ?? "TOTAL") === "TOTAL" && (s.group != null || /GROUP/i.test(s.stage)),
  );
  return groups
    .map((s) => ({
      letter: groupLetter(s.group ?? s.stage),
      table: [...s.table].sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

/**
 * 48 队赛制：每组前 2 直接晋级 + 8 个成绩最好的小组第三。
 * 返回晋级的"最佳第三名"球队 id 集合。
 */
export function bestThirdIds(groups: GroupTable[]): Set<number> {
  const thirds = groups
    .map((g) => g.table[2])
    .filter((r): r is StandingRow => Boolean(r));
  thirds.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor,
  );
  return new Set(thirds.slice(0, 8).map((r) => r.team.id));
}

/** 名次对应的晋级状态：1/2 直接晋级，最佳第三晋级，其余淘汰 */
export type QualifyState = "direct" | "best-third" | "contention" | "out";

export function qualifyState(row: StandingRow, bestThirds: Set<number>, played: number): QualifyState {
  if (row.position <= 2) return "direct";
  if (row.position === 3) return bestThirds.has(row.team.id) ? "best-third" : played < 3 ? "contention" : "out";
  return "out";
}

/** 射手榜：进球→助攻→点球少者优先 */
export function toScorers(res?: ScorersResponse | null): ScorerRaw[] {
  return [...(res?.scorers ?? [])].sort(
    (a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0) || (a.penalties ?? 0) - (b.penalties ?? 0),
  );
}

/** 把比赛按状态拆分：已赛（倒序）/ 待赛（正序）/ 进行中 */
export function splitMatches(res?: MatchesResponse | null): SplitMatches {
  const all = res?.matches ?? [];
  const finished = all.filter((m) => m.status === "FINISHED").sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  const upcoming = all
    .filter((m) => m.status === "TIMED" || m.status === "SCHEDULED")
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const live = all.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  return { all, finished, upcoming, live };
}

/** 每组总进球（用于图表） */
export function goalsByGroup(groups: GroupTable[]): { group: string; goals: number }[] {
  return groups.map((g) => ({
    group: g.letter,
    goals: g.table.reduce((sum, r) => sum + r.goalsFor, 0),
  }));
}

/** 每个轮次的总进球与场次（用于图表） */
export function goalsByMatchday(finished: MatchRaw[]): { matchday: string; goals: number; matches: number }[] {
  const map = new Map<number, { goals: number; matches: number }>();
  for (const m of finished) {
    const md = m.matchday ?? 0;
    const slot = map.get(md) ?? { goals: 0, matches: 0 };
    slot.goals += (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0);
    slot.matches += 1;
    map.set(md, slot);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([md, v]) => ({ matchday: `第${md}轮`, goals: v.goals, matches: v.matches }));
}

/** 一支球队最近的已赛比赛（用于资料卡） */
export function teamRecentMatches(teamId: number, finished: MatchRaw[], limit = 5): MatchRaw[] {
  return finished.filter((m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId).slice(0, limit);
}

/** 过滤今日比赛：已完赛 + 进行中 + 待踢（按北京时间当天） */
export function todayMatches(split: SplitMatches): { matches: MatchRaw[]; fallback: boolean } {
  const now = new Date();
  // 北京时间为 UTC+8，取北京当天 00:00 ~ 24:00 对应的 UTC 范围
  const bjStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), -8, 0, 0));
  const bjEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0));
  const startISO = bjStart.toISOString();
  const endISO = bjEnd.toISOString();

  // 优先取今天的比赛
  const todayAll = [
    ...split.live,
    ...split.finished.filter((m) => m.utcDate >= startISO && m.utcDate <= endISO),
    ...split.upcoming.filter((m) => m.utcDate >= startISO && m.utcDate <= endISO),
  ].sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (todayAll.length > 0) return { matches: todayAll, fallback: false };

  // 今天无比赛 → 回退到最近一个比赛日的已完赛比赛
  if (split.finished.length > 0) {
    const latestDate = split.finished[0].utcDate.slice(0, 10); // finished 已按日期倒序
    const recent = split.finished.filter((m) => m.utcDate.slice(0, 10) === latestDate);
    return { matches: recent.sort((a, b) => a.utcDate.localeCompare(b.utcDate)), fallback: true };
  }
  return { matches: [], fallback: false };
}
