import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Swords } from "lucide-react";
import type { GroupTable, MatchRaw, ScorerRaw, SplitMatches, StandingRow } from "../types/worldcup";
import { teamZh, playerZh, coachZh, isStarPlayer, playerFaceUrl, flagUrl } from "../lib/teams";
import { dayLabel } from "../lib/format";
import { Card, Flag, SectionHeading, cn } from "../components/ui";
import { useTeams, positionGroup, POSITION_GROUPS, ageFromDob, type TeamSquad } from "../api/teams";
import { teamKnockoutStats, teamKnockoutScorers, teamPlayerGoals } from "../lib/transform";

interface TeamEntry {
  id: number;
  name: string;
  tla?: string | null;
  group: string;
  row: StandingRow;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/40 px-3 py-2 text-center">
      <div className={cn("font-display text-xl font-bold tabular-nums", tone ?? "text-ink")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function ResultBadge({ r }: { r: "W" | "D" | "L" }) {
  const map = { W: "bg-pitch/20 text-pitch", D: "bg-muted/20 text-muted", L: "bg-primary/20 text-primary-bright" };
  const label = { W: "胜", D: "平", L: "负" };
  return <span className={cn("grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold", map[r])}>{label[r]}</span>;
}

function Detail({
  entry,
  matches,
  scorers,
  squad,
  teamsLoading,
}: {
  entry: TeamEntry;
  matches: MatchRaw[];
  scorers: ScorerRaw[];
  squad: TeamSquad | null;
  teamsLoading: boolean;
}) {
  const { row } = entry;
  const [rosterOpen, setRosterOpen] = useState(false);

  // 本队与各对手的全部对阵：已赛在前（近→远），未赛在后（近→远）
  const teamMatches = useMemo(() => {
    const mine = matches.filter((m) => m.homeTeam.id === entry.id || m.awayTeam.id === entry.id);
    const fin = mine.filter((m) => m.status === "FINISHED").sort((a, b) => b.utcDate.localeCompare(a.utcDate));
    const up = mine.filter((m) => m.status !== "FINISHED").sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    return [...fin, ...up].slice(0, 6);
  }, [matches, entry.id]);

  // 核心球员：本队射手（带进球）∪ 已收录明星球员（来自阵容），按进球降序；
  // 若都没有，则兜底展示锋线核心，保证非空
  const keyPlayers = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; goals: number; position?: string | null }>();
    for (const s of scorers) if (s.team.id === entry.id) byId.set(s.player.id, { id: s.player.id, name: s.player.name, goals: s.goals });
    if (squad)
      for (const p of squad.squad)
        if (isStarPlayer(p.id) && !byId.has(p.id)) byId.set(p.id, { id: p.id, name: p.name, goals: 0, position: p.position });
    let list = [...byId.values()].sort((a, b) => b.goals - a.goals);
    if (list.length === 0 && squad) {
      list = squad.squad
        .filter((p) => positionGroup(p.position) === "前锋")
        .slice(0, 4)
        .map((p) => ({ id: p.id, name: p.name, goals: 0, position: p.position }));
    }
    return list.slice(0, 8);
  }, [scorers, squad, entry.id]);

  // 淘汰赛数据
  const knockout = useMemo(() => teamKnockoutStats(entry.id, matches), [matches, entry.id]);
  const knockoutScorers = useMemo(() => teamKnockoutScorers(entry.id, matches), [matches, entry.id]);

  // 按阶段分组比赛：小组赛 vs 淘汰赛
  const groupMatches = useMemo(() => teamMatches.filter((m) => m.stage === "GROUP_STAGE"), [teamMatches]);
  const knockoutMatches = useMemo(() => teamMatches.filter((m) => m.stage !== "GROUP_STAGE" && m.status === "FINISHED"), [teamMatches]);

  // 球员进球统计（小组赛+淘汰赛）
  const playerGoals = useMemo(() => teamPlayerGoals(entry.id, matches), [matches, entry.id]);

  return (
    <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-line/60 bg-gradient-to-r from-surface-2/60 to-transparent px-5 py-4">
          <Flag name={entry.name} className="!h-12 !w-[4.5rem] shadow-md" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-2xl font-bold text-ink">{teamZh(entry.name)}</h3>
              <span className="text-xs text-muted">{entry.tla}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-semibold text-primary-bright">小组 {entry.group}</span>
              <span>当前第 {row.position} 名</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 p-4">
          <Stat label="积分" value={row.points} tone="text-gold" />
          <Stat label="胜平负" value={`${row.won}/${row.draw}/${row.lost}`} />
          <Stat label="进球" value={row.goalsFor} tone="text-pitch" />
          <Stat label="净胜" value={`${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}`} />
        </div>

        {/* 淘汰赛数据 */}
        {knockout && (
          <div className="mx-4 mb-4 rounded-xl border border-gold/25 bg-gold/[0.04]">
            <div className="flex items-center gap-2 border-b border-gold/15 px-4 py-3">
              <Swords className="h-4 w-4 text-gold" />
              <span className="text-xs font-semibold text-gold">淘汰赛征程</span>
              <span className="text-[10px] text-gold/60">
                {knockout.eliminated ? "已结束" : "进行中"} · {knockout.bestStage}
              </span>
            </div>
            {/* 淘汰赛统计 */}
            <div className="grid grid-cols-4 gap-2 p-3">
              <div className="rounded-lg bg-surface-2/40 px-2 py-2 text-center">
                <div className="font-display text-lg font-bold tabular-nums text-gold">{knockout.played}</div>
                <div className="text-[10px] text-muted">淘汰赛场次</div>
              </div>
              <div className="rounded-lg bg-surface-2/40 px-2 py-2 text-center">
                <div className="font-display text-lg font-bold tabular-nums text-ink">
                  <span className="text-pitch">{knockout.wins}</span>
                  {knockout.draws > 0 && <span className="text-muted">/{knockout.draws}</span>}
                  <span className="text-primary-bright">/{knockout.losses}</span>
                </div>
                <div className="text-[10px] text-muted">胜负(含点球)</div>
              </div>
              <div className="rounded-lg bg-surface-2/40 px-2 py-2 text-center">
                <div className="font-display text-lg font-bold tabular-nums text-pitch">{knockout.goalsFor}</div>
                <div className="text-[10px] text-muted">进球</div>
              </div>
              <div className="rounded-lg bg-surface-2/40 px-2 py-2 text-center">
                <div className="font-display text-lg font-bold tabular-nums text-primary-bright">{knockout.goalsAgainst}</div>
                <div className="text-[10px] text-muted">失球</div>
              </div>
            </div>
            {/* 淘汰赛对战列表 */}
            <div className="px-3 pb-3 space-y-1">
              {knockout.matches.map((kr) => {
                const oppFlag = flagUrl(kr.opponentName);
                const penNote = kr.scoredByGoals ? " （点球）" : "";
                return (
                  <div key={kr.match.id} className="flex items-center gap-2 rounded-lg bg-surface/50 px-2 py-1.5">
                    <ResultBadge r={kr.result === "D" ? "D" : kr.result} />
                    <span className="w-16 shrink-0 text-[10px] font-semibold text-gold/80">{kr.stageLabel}</span>
                    {oppFlag && <img src={oppFlag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow" />}
                    <span className="flex-1 truncate text-xs text-ink">{teamZh(kr.opponentName)}</span>
                    <span className="font-display text-xs font-bold tabular-nums text-ink">
                      {kr.goalsFor}-{kr.goalsAgainst}
                      <span className="text-[10px] text-muted font-normal">{penNote}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {/* 淘汰赛进球球员 */}
            {knockoutScorers.length > 0 && (
              <div className="border-t border-gold/15 px-3 py-2">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold/70">淘汰赛射手</div>
                <div className="flex flex-wrap gap-1.5">
                  {knockoutScorers.map((ks, i) => (
                    <span key={ks.playerId || `${ks.playerName}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-1">
                      <span className="text-[11px] font-medium text-ink">{playerZh(ks.playerId, ks.playerName)}</span>
                      <span className="font-display text-xs font-bold tabular-nums text-gold">{ks.goals}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
          <div>
            {/* 小组赛对阵 */}
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">小组赛战绩</div>
            <div className="space-y-1.5 mb-3">
              {groupMatches.length === 0 && <div className="text-sm text-muted">暂无</div>}
              {groupMatches.map((m) => {
                const home = m.homeTeam.id === entry.id;
                const opp = home ? m.awayTeam : m.homeTeam;
                const finished = m.status === "FINISHED";
                const gf = home ? m.score.fullTime.home : m.score.fullTime.away;
                const ga = home ? m.score.fullTime.away : m.score.fullTime.home;
                const res: "W" | "D" | "L" | null =
                  finished && gf != null && ga != null ? (gf > ga ? "W" : gf < ga ? "L" : "D") : null;
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-2/30 px-2 py-1.5">
                    {res ? (
                      <ResultBadge r={res} />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-line/40 text-[10px] font-bold text-muted">
                        未
                      </span>
                    )}
                    <Flag name={opp.name} />
                    <span className="flex-1 truncate text-sm text-ink">{teamZh(opp.name)}</span>
                    {finished ? (
                      <span className="font-display text-sm font-bold tabular-nums text-ink">
                        {gf}-{ga}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">{dayLabel(m.utcDate)}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 淘汰赛对阵 */}
            {knockoutMatches.length > 0 && (
              <>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gold">淘汰赛战绩</div>
                <div className="space-y-1.5">
                  {knockoutMatches.map((m) => {
                    const home = m.homeTeam.id === entry.id;
                    const opp = home ? m.awayTeam : m.homeTeam;
                    const finished = m.status === "FINISHED";
                    const gf = home ? m.score.fullTime.home : m.score.fullTime.away;
                    const ga = home ? m.score.fullTime.away : m.score.fullTime.home;
                    const res: "W" | "D" | "L" | null =
                      finished && gf != null && ga != null ? (gf > ga ? "W" : gf < ga ? "L" : "D") : null;
                    return (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg bg-gold/[0.06] border border-gold/10 px-2 py-1.5">
                        {res ? (
                          <ResultBadge r={res} />
                        ) : (
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-line/40 text-[10px] font-bold text-muted">
                            未
                          </span>
                        )}
                        <Flag name={opp.name} />
                        <span className="flex-1 truncate text-sm text-ink">{teamZh(opp.name)}</span>
                        {finished ? (
                          <span className="font-display text-sm font-bold tabular-nums text-ink">
                            {gf}-{ga}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">{dayLabel(m.utcDate)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">核心球员</div>
            <div className="space-y-1.5">
              {keyPlayers.length === 0 && (
                <div className="text-sm text-muted">{teamsLoading ? "加载中…" : "暂无突出球员"}</div>
              )}
              {keyPlayers.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2/30 px-2.5 py-1.5">
                  <img
                    src={playerFaceUrl(p.id, p.name, entry.name)}
                    alt=""
                    loading="lazy"
                    className="h-8 w-8 shrink-0 rounded-full bg-surface-2 object-cover ring-1 ring-line/60"
                  />
                  <span className="flex-1 truncate text-sm text-ink">{playerZh(p.id, p.name)}</span>
                  {p.goals > 0 ? (
                    <span className="flex items-baseline gap-0.5">
                      <span className="font-display text-sm font-bold text-gold tabular-nums">{p.goals}</span>
                      <span className="text-[10px] text-muted">球</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">{p.position ? positionGroup(p.position) : "球星"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 阵容名单（可折叠） */}
        <div className="border-t border-line/40">
          <button
            onClick={() => setRosterOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-surface-2/20"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              阵容名单
              {squad?.squad?.length ? <span className="text-ink">{squad.squad.length}人</span> : null}
            </span>
            <span className="flex items-center gap-2">
              {squad?.coach?.name && (
                <span className="text-xs text-muted">
                  主教练 <span className="text-ink">{coachZh(squad.coach.name)}</span>
                </span>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", rosterOpen && "rotate-180")} />
            </span>
          </button>
          {rosterOpen && (
            <div className="px-4 pb-4">
              {!squad || squad.squad.length === 0 ? (
                <div className="rounded-lg bg-surface-2/30 px-3 py-3 text-center text-xs text-muted">
                  {teamsLoading ? "名单加载中…" : "暂无名单数据（需实时数据源）"}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {POSITION_GROUPS.map((g) => {
                    const list = squad.squad.filter((p) => positionGroup(p.position) === g);
                    if (list.length === 0) return null;
                    return (
                      <div key={g}>
                        <div className="mb-1.5 flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-primary-bright">{g}</span>
                          <span className="text-[10px] text-muted">{list.length}人</span>
                        </div>
                        <div className="space-y-1">
                          {list.map((p) => {
                            const age = ageFromDob(p.dateOfBirth);
                            const goals = playerGoals.get(String(p.id)) ?? playerGoals.get(p.name);
                            const hasGoals = goals && goals.totalGoals > 0;
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-md px-2 py-1",
                                  hasGoals ? "bg-pitch/[0.08] border border-pitch/25" : "bg-surface-2/30",
                                )}
                              >
                                <span className="truncate text-xs text-ink">{playerZh(p.id, p.name)}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {hasGoals ? (
                                    <>
                                      {goals.groupGoals > 0 && (
                                        <span className="font-display text-[10px] font-bold tabular-nums text-ink">{goals.groupGoals}<span className="font-normal text-muted">G</span></span>
                                      )}
                                      {goals.knockoutGoals > 0 && (
                                        <span className="font-display text-[10px] font-bold tabular-nums text-gold">{goals.knockoutGoals}<span className="font-normal text-muted">K</span></span>
                                      )}
                                    </>
                                  ) : (
                                    age != null ? <span className="text-[10px] text-muted">{age}岁</span> : null
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

/** 可折叠小组区块 */
function GroupSection({
  group,
  entries,
  current,
  onSelect,
  open,
  onToggle,
}: {
  group: GroupTable;
  entries: TeamEntry[];
  current: TeamEntry | null;
  onSelect: (id: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const hasCurrent = current ? entries.some((e) => e.id === current.id) : false;

  const played = Math.max(...group.table.map((r) => r.playedGames), 0);
  const activeTeam = entries.find((e) => current && e.id === current.id);
  return (
    <div className={cn("rounded-xl border overflow-hidden transition-colors", hasCurrent ? "border-primary/30 bg-primary/[0.03]" : "border-line/60 bg-surface/40")}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-2/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs font-bold text-white shadow",
            hasCurrent ? "bg-primary-bright" : "bg-primary",
          )}>
            {group.letter}
          </span>
          <span className="font-display text-xs font-semibold tracking-wide text-ink">小组 {group.letter}</span>
          <span className="text-[10px] text-muted shrink-0">{played >= 3 ? "收官" : `${entries.length} 队`}</span>
          {!open && activeTeam && (
            <>
              <span className="text-muted select-none">·</span>
              <span className="truncate text-[11px] text-primary-bright font-medium">{teamZh(activeTeam.name)}</span>
            </>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                    current?.id === e.id
                      ? "border-primary/60 bg-primary/10 shadow-sm"
                      : "border-line/40 bg-surface/50 hover:border-line hover:bg-surface-2/60",
                  )}
                >
                  <Flag name={e.name} className="!h-4 !w-[1.5rem]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-ink">{teamZh(e.name)}</div>
                    <div className="text-[10px] text-muted">
                      {e.row.points} 分 · {e.row.won}胜{e.row.draw}平{e.row.lost}负
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TeamCards({
  groups,
  matches,
  scorers,
}: {
  groups: GroupTable[];
  matches: SplitMatches;
  scorers: ScorerRaw[];
}) {
  const entries = useMemo<TeamEntry[]>(
    () =>
      groups.flatMap((g) =>
        g.table.map((row) => ({ id: row.team.id, name: row.team.name, tla: row.team.tla, group: g.letter, row })),
      ),
    [groups],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const current = entries.find((e) => e.id === selected) ?? entries[0];
  const { teams, loading: teamsLoading } = useTeams();

  // 响应式列数：md+ 为 4 列，否则 2 列
  const [cols, setCols] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 4 : 2,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setCols(e.matches ? 4 : 2);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 按行管理展开状态（每行所有小组同时展开/收起）
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // 当选中的球队变更时，自动展开其所在行
  useEffect(() => {
    if (!current) return;
    const groupIdx = groups.findIndex((g) => g.letter === current.group);
    if (groupIdx === -1) return;
    const rowIdx = Math.floor(groupIdx / cols);
    setExpandedRows((prev) => {
      if (prev.has(rowIdx)) return prev;
      const next = new Set(prev);
      next.add(rowIdx);
      return next;
    });
  }, [current, cols, groups]);

  // 切换某行所有小组的展开状态
  const toggleRow = (groupIdx: number) => {
    const rowIdx = Math.floor(groupIdx / cols);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  };

  // 自动展开对应小组 + 滚动到详情卡片
  const handleSelect = (id: number) => {
    setSelected(id);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  // 按小组分组：group.letter → TeamEntry[]
  const grouped = useMemo(() => {
    const map = new Map<string, TeamEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.group) ?? [];
      arr.push(e);
      map.set(e.group, arr);
    }
    return map;
  }, [entries]);

  return (
    <section>
      <SectionHeading kicker="球队" title="球队资料卡" right={<span className="text-[11px] text-muted">点击小组展开 · 选择球队</span>} />

      {/* 小组抽屉式选择区 */}
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        {groups.map((g, idx) => {
          const rowIdx = Math.floor(idx / cols);
          return (
            <GroupSection
              key={g.letter}
              group={g}
              entries={grouped.get(g.letter) ?? []}
              current={current}
              onSelect={handleSelect}
              open={expandedRows.has(rowIdx)}
              onToggle={() => toggleRow(idx)}
            />
          );
        })}
      </div>

      {/* 球队详情 */}
      <div ref={detailRef}>
        {current && (
          <Detail
            entry={current}
            matches={matches.all}
            scorers={scorers}
            squad={teams?.get(current.id) ?? null}
            teamsLoading={teamsLoading}
          />
        )}
      </div>
    </section>
  );
}
