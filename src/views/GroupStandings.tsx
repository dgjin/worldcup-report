import { motion } from "motion/react";
import type { GroupTable, StandingRow } from "../types/worldcup";
import { bestThirdIds, qualifyState, type QualifyState } from "../lib/transform";
import { teamZh } from "../lib/teams";
import { Card, Flag, SectionHeading, Tag, cn } from "../components/ui";

const ROW_TONE: Record<QualifyState, string> = {
  direct: "border-l-pitch bg-pitch/[0.06]",
  "best-third": "border-l-gold bg-gold/[0.06]",
  contention: "border-l-line",
  out: "border-l-transparent opacity-55",
};

function Row({ row, state }: { row: StandingRow; state: QualifyState }) {
  return (
    <tr className={cn("border-l-2 transition-colors", ROW_TONE[state])}>
      <td className="py-2 pl-2 pr-1 text-center font-display text-sm font-bold text-muted tabular-nums">{row.position}</td>
      <td className="py-2 pr-2">
        <span className="flex items-center gap-2">
          <Flag name={row.team.name} />
          <span className="truncate text-sm font-medium text-ink">{teamZh(row.team.name)}</span>
        </span>
      </td>
      <td className="px-1 text-center text-xs text-muted tabular-nums">{row.playedGames}</td>
      <td className="px-1 text-center text-xs text-muted tabular-nums">
        {row.won}/{row.draw}/{row.lost}
      </td>
      <td className="px-1 text-center text-xs text-muted tabular-nums">
        {row.goalsFor}:{row.goalsAgainst}
      </td>
      <td className="px-1 text-center text-xs tabular-nums">
        <span className={cn(row.goalDifference > 0 ? "text-pitch" : row.goalDifference < 0 ? "text-primary-bright" : "text-muted")}>
          {row.goalDifference > 0 ? "+" : ""}
          {row.goalDifference}
        </span>
      </td>
      <td className="py-2 pl-1 pr-2 text-center font-display text-base font-bold text-ink tabular-nums">{row.points}</td>
    </tr>
  );
}

function GroupCard({ group, bestThirds, index }: { group: GroupTable; bestThirds: Set<number>; index: number }) {
  const played = Math.max(...group.table.map((r) => r.playedGames), 0);
  return (
    <motion.div
      id={`group-${group.letter}`}
      className="scroll-mt-16 md:scroll-mt-20"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
    >
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/60 bg-surface-2/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-white shadow">
              {group.letter}
            </span>
            <span className="font-display text-sm font-semibold tracking-wide text-ink">小组 {group.letter}</span>
          </div>
          <span className="text-[10px] text-muted">{played >= 3 ? "已收官" : `第 ${played} 轮`}</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase text-muted">
              <th className="py-1.5 pl-2 font-medium">#</th>
              <th className="py-1.5 text-left font-medium">球队</th>
              <th className="font-medium">赛</th>
              <th className="font-medium">胜平负</th>
              <th className="font-medium">进失</th>
              <th className="font-medium">净</th>
              <th className="py-1.5 pr-2 font-medium">分</th>
            </tr>
          </thead>
          <tbody>
            {group.table.map((row) => (
              <Row key={row.team.id} row={row} state={qualifyState(row, bestThirds, played)} />
            ))}
          </tbody>
        </table>
      </Card>
    </motion.div>
  );
}

// 小组编号索引：点编号快速跳转到对应小组（移动端吸顶常驻，桌面端置于顶部）
function GroupIndex({ groups }: { groups: GroupTable[] }) {
  const jump = (letter: string) =>
    document.getElementById(`group-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line/40 bg-bg/90 px-4 py-1.5 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 pr-0.5 text-[11px] font-semibold text-muted">跳转</span>
        {groups.map((g) => {
          const leader = g.table[0];
          return (
            <button
              key={g.letter}
              onClick={() => jump(g.letter)}
              aria-label={`跳转到小组 ${g.letter}`}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-line/60 bg-surface/50 px-2 py-1 transition-all hover:border-primary/50 hover:bg-surface-2/60 active:scale-95"
            >
              <span className="grid h-5 w-5 place-items-center rounded bg-primary text-[11px] font-bold text-white">
                {g.letter}
              </span>
              {leader && <Flag name={leader.team.name} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GroupStandings({ groups }: { groups: GroupTable[] }) {
  const bestThirds = bestThirdIds(groups);
  return (
    <section>
      <SectionHeading
        kicker="小组赛"
        title="小组赛积分榜"
        right={
          <div className="hidden items-center gap-2 sm:flex">
            <Tag tone="cool">前二晋级</Tag>
            <Tag tone="gold">最佳第三</Tag>
          </div>
        }
      />
      <p className="mb-3 text-xs text-muted sm:hidden">
        <span className="text-pitch">绿</span>=前二晋级 · <span className="text-gold">金</span>=最佳第三名（取 8 席）
      </p>
      <GroupIndex groups={groups} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((g, i) => (
          <GroupCard key={g.letter} group={g} bestThirds={bestThirds} index={i} />
        ))}
      </div>
    </section>
  );
}
