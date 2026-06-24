import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { GroupTable, MatchRaw, ScorerRaw, SplitMatches, StandingRow } from "../types/worldcup";
import { teamZh, playerZh, coachZh, isStarPlayer, playerFaceUrl } from "../lib/teams";
import { dayLabel } from "../lib/format";
import { Card, Flag, SectionHeading, cn } from "../components/ui";
import { useTeams, positionGroup, POSITION_GROUPS, ageFromDob, type TeamSquad } from "../api/teams";

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

        <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">对阵战绩</div>
            <div className="space-y-1.5">
              {teamMatches.length === 0 && <div className="text-sm text-muted">暂无</div>}
              {teamMatches.map((m) => {
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
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-2 rounded-md bg-surface-2/30 px-2 py-1"
                              >
                                <span className="truncate text-xs text-ink">{playerZh(p.id, p.name)}</span>
                                {age != null && <span className="shrink-0 text-[10px] text-muted">{age}岁</span>}
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
}: {
  group: GroupTable;
  entries: TeamEntry[];
  current: TeamEntry | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const played = Math.max(...group.table.map((r) => r.playedGames), 0);
  return (
    <div className="rounded-2xl border border-line/60 bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-surface-2/30"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-white shadow">
            {group.letter}
          </span>
          <span className="font-display text-sm font-semibold tracking-wide text-ink">小组 {group.letter}</span>
          <span className="text-[10px] text-muted">{played >= 3 ? "已收官" : `${entries.length} 队`}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform duration-200", !open && "-rotate-90")} />
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
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    current?.id === e.id
                      ? "border-primary/60 bg-primary/10 shadow-sm"
                      : "border-line/40 bg-surface/50 hover:border-line hover:bg-surface-2/60",
                  )}
                >
                  <Flag name={e.name} className="!h-5 !w-[1.8rem]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-ink">{teamZh(e.name)}</div>
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
  const current = entries.find((e) => e.id === selected) ?? entries[0];
  const { teams, loading: teamsLoading } = useTeams();

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
      <SectionHeading kicker="球队" title="球队资料卡" right={<span className="text-[11px] text-muted">点选球队查看详情</span>} />
      {current && (
        <Detail
          entry={current}
          matches={matches.all}
          scorers={scorers}
          squad={teams?.get(current.id) ?? null}
          teamsLoading={teamsLoading}
        />
      )}

      <div className="mt-5 grid gap-3">
        {groups.map((g) => (
          <GroupSection
            key={g.letter}
            group={g}
            entries={grouped.get(g.letter) ?? []}
            current={current}
            onSelect={setSelected}
          />
        ))}
      </div>
    </section>
  );
}
