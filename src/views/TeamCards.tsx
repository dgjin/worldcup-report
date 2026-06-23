import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { GroupTable, MatchRaw, ScorerRaw, SplitMatches, StandingRow } from "../types/worldcup";
import { teamRecentMatches } from "../lib/transform";
import { teamZh, playerZh, coachZh } from "../lib/teams";
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
  const recent = teamRecentMatches(entry.id, matches);
  const players = scorers.filter((s) => s.team.id === entry.id).sort((a, b) => b.goals - a.goals);
  const { row } = entry;

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
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">近期战绩</div>
            <div className="space-y-1.5">
              {recent.length === 0 && <div className="text-sm text-muted">暂无</div>}
              {recent.map((m) => {
                const home = m.homeTeam.id === entry.id;
                const gf = (home ? m.score.fullTime.home : m.score.fullTime.away) ?? 0;
                const ga = (home ? m.score.fullTime.away : m.score.fullTime.home) ?? 0;
                const opp = home ? m.awayTeam : m.homeTeam;
                const res: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-2/30 px-2 py-1.5">
                    <ResultBadge r={res} />
                    <Flag name={opp.name} />
                    <span className="flex-1 truncate text-sm text-ink">{teamZh(opp.name)}</span>
                    <span className="font-display text-sm font-bold tabular-nums text-ink">
                      {gf}-{ga}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">核心射手</div>
            <div className="space-y-1.5">
              {players.length === 0 && <div className="text-sm text-muted">本队暂无进球记录</div>}
              {players.map((p) => (
                <div key={p.player.id} className="flex items-center gap-2 rounded-lg bg-surface-2/30 px-3 py-1.5">
                  <span className="flex-1 truncate text-sm text-ink">{playerZh(p.player.id, p.player.name)}</span>
                  <span className="font-display text-sm font-bold text-gold tabular-nums">{p.goals}</span>
                  <span className="text-[10px] text-muted">球</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 阵容名单 */}
        <div className="border-t border-line/40 px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              阵容名单{squad?.squad?.length ? ` · ${squad.squad.length}人` : ""}
            </div>
            {squad?.coach?.name && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted">主教练</span>
                <span className="font-semibold text-ink">{coachZh(squad.coach.name)}</span>
              </div>
            )}
          </div>
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
      </Card>
    </motion.div>
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

  return (
    <section>
      <SectionHeading kicker="球队" title="球队资料卡" right={<span className="text-[11px] text-muted">点选球队查看详情</span>} />
      {current && (
        <Detail
          entry={current}
          matches={matches.finished}
          scorers={scorers}
          squad={teams?.get(current.id) ?? null}
          teamsLoading={teamsLoading}
        />
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {entries.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
              current?.id === e.id
                ? "border-primary/60 bg-primary/10"
                : "border-line/50 bg-surface/40 hover:border-line hover:bg-surface-2/50",
            )}
          >
            <Flag name={e.name} />
            <span className="truncate text-xs text-ink">{teamZh(e.name)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
