import { ChevronRight, Trophy } from "lucide-react";
import type { GroupTable, MatchRaw, SplitMatches } from "../types/worldcup";
import { bestThirdIds } from "../lib/transform";
import { teamZh } from "../lib/teams";
import { dayKey, dayLabel, timeLabel } from "../lib/format";
import { Card, Flag, SectionHeading, Tag, cn } from "../components/ui";
import KnockoutDraw from "./KnockoutDraw";

const ROUNDS = [
  { name: "32 强赛", n: 16 },
  { name: "16 强赛", n: 8 },
  { name: "1/4 决赛", n: 4 },
  { name: "半决赛", n: 2 },
  { name: "决赛", n: 1 },
];

function FixtureRow({ m }: { m: MatchRaw }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <span className="w-12 shrink-0 text-xs text-muted tabular-nums">{timeLabel(m.utcDate)}</span>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-2 text-[10px] font-bold text-muted">
        {m.group?.replace(/GROUP_/i, "") ?? "—"}
      </span>
      <span className="flex flex-1 items-center justify-end gap-2 truncate">
        <span className="truncate text-right">{teamZh(m.homeTeam.name)}</span>
        <Flag name={m.homeTeam.name} />
      </span>
      <span className="shrink-0 text-xs font-bold text-muted">VS</span>
      <span className="flex flex-1 items-center gap-2 truncate">
        <Flag name={m.awayTeam.name} />
        <span className="truncate">{teamZh(m.awayTeam.name)}</span>
      </span>
    </div>
  );
}

function Fixtures({ upcoming }: { upcoming: MatchRaw[] }) {
  const byDay = new Map<string, MatchRaw[]>();
  for (const m of upcoming) {
    const k = dayKey(m.utcDate);
    const arr = byDay.get(k);
    if (arr) arr.push(m);
    else byDay.set(k, [m]);
  }
  const days = [...byDay.entries()].slice(0, 6);

  if (days.length === 0) return <Card className="p-6 text-center text-sm text-muted">暂无后续赛程</Card>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map(([k, list]) => (
        <Card key={k} className="overflow-hidden">
          <div className="border-b border-line/60 bg-surface-2/40 px-3 py-2 font-display text-sm font-semibold text-ink">
            {dayLabel(list[0].utcDate)}
          </div>
          <div className="divide-y divide-line/40">
            {list.map((m) => (
              <FixtureRow key={m.id} m={m} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function QualifierGrid({ groups }: { groups: GroupTable[] }) {
  const bestThirds = bestThirdIds(groups);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {groups.map((g) => {
        const [first, second, third] = g.table;
        return (
          <Card key={g.letter} className="p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded bg-primary text-[10px] font-bold text-white">{g.letter}</span>
              <span className="text-[11px] text-muted">小组出线</span>
            </div>
            <div className="space-y-1.5">
              {[first, second].map((row, i) => (
                <div key={row.team.id} className="flex items-center gap-1.5">
                  <span className={cn("text-[10px] font-bold", i === 0 ? "text-gold" : "text-pitch")}>{i + 1}</span>
                  <Flag name={row.team.name} />
                  <span className="truncate text-xs text-ink">{teamZh(row.team.name)}</span>
                </div>
              ))}
              {third && bestThirds.has(third.team.id) && (
                <div className="flex items-center gap-1.5 opacity-80">
                  <span className="text-[10px] font-bold text-amber-500">3</span>
                  <Flag name={third.team.name} />
                  <span className="truncate text-xs text-muted">{teamZh(third.team.name)}</span>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ChampionPath() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {ROUNDS.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="grid h-16 w-20 place-items-center rounded-xl border border-line/70 bg-surface-2/40 sm:h-20 sm:w-24">
                <span className="font-display text-2xl font-bold text-ink sm:text-3xl">{r.n}</span>
                <span className="text-[10px] text-muted">{r.n === 1 ? "1 场" : `${r.n} 场`}</span>
              </div>
              <span className="text-[11px] font-semibold text-muted">{r.name}</span>
            </div>
            {i < ROUNDS.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-line" />}
          </div>
        ))}
        <div className="flex flex-col items-center gap-1">
          <div className="grid h-16 w-20 place-items-center rounded-xl border border-gold/50 bg-gold/10 sm:h-20 sm:w-24">
            <Trophy className="h-8 w-8 text-gold" />
          </div>
          <span className="text-[11px] font-semibold text-gold">大力神杯</span>
        </div>
      </div>
    </Card>
  );
}

export default function KnockoutBracket({ groups, matches }: { groups: GroupTable[]; matches: SplitMatches }) {
  // 淘汰赛比赛
  const knockoutMatches = matches.all.filter((m) => m.stage !== "GROUP_STAGE");

  return (
    <section className="space-y-8">
      <div>
        <SectionHeading
          kicker="赛程安排"
          title="近期赛程"
          right={matches.live.length > 0 ? <Tag tone="hot">{matches.live.length} 场进行中</Tag> : undefined}
        />
        <Fixtures upcoming={matches.upcoming} />
      </div>

      <div>
        <KnockoutDraw matches={knockoutMatches} />
      </div>

      <div>
        <SectionHeading kicker="晋级之路" title="冠军之路" />
        <ChampionPath />
      </div>

      <div>
        <SectionHeading
          kicker="出线形势"
          title="晋级席位推演"
          right={<span className="text-[11px] text-muted">依当前积分推演 · 非最终结果</span>}
        />
        <QualifierGrid groups={groups} />
      </div>
    </section>
  );
}
