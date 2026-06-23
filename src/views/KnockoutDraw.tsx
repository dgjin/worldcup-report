import { useMemo, useState } from "react";
import type { MatchRaw } from "../types/worldcup";
import { teamZh } from "../lib/teams";
import { Card, Flag, SectionHeading, cn } from "../components/ui";
import { timeLabel } from "../lib/format";
import { ChevronDown } from "lucide-react";

const STAGE_ORDER = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"] as const;
type KnockoutStage = (typeof STAGE_ORDER)[number];

const STAGE_ZH: Record<KnockoutStage, string> = {
  LAST_32: "32强",
  LAST_16: "16强",
  QUARTER_FINALS: "1/4决赛",
  SEMI_FINALS: "半决赛",
  FINAL: "决赛",
};

const STAGE_COUNT: Record<KnockoutStage, number> = {
  LAST_32: 16,
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  FINAL: 1,
};

function MatchSlot({ m, compact = false }: { m: MatchRaw; compact?: boolean }) {
  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const homeName = m.homeTeam.name;
  const awayName = m.awayTeam.name;
  const homeWin = isFinished && m.score.winner === "HOME_TEAM";
  const awayWin = isFinished && m.score.winner === "AWAY_TEAM";
  const w = compact ? "w-36" : "w-44";

  return (
    <div
      className={cn(
        `${w} shrink-0 overflow-hidden rounded-xl border bg-surface/80 backdrop-blur-sm shadow-sm transition-all`,
        isLive ? "border-primary/60 shadow-primary/20 shadow-md" : "border-line/60",
      )}
    >
      <div className={cn(
        "px-2 py-0.5 text-[9px] font-semibold text-center",
        isLive ? "bg-primary/20 text-primary-bright" : "bg-surface-2/50 text-muted",
      )}>
        {isLive ? "🔴 进行中" : isFinished ? "已完赛" : timeLabel(m.utcDate)}
      </div>
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 border-b border-line/40",
        homeWin && "bg-pitch/10",
      )}>
        <Flag name={homeName} />
        <span className={cn("flex-1 truncate text-[11px]", homeWin ? "font-bold text-ink" : "text-muted/90")}>
          {homeName ? teamZh(homeName) : <span className="italic text-muted/50">待定</span>}
        </span>
        {isFinished && (
          <span className={cn("font-display font-bold tabular-nums text-sm", homeWin ? "text-pitch" : "text-muted")}>
            {m.score.fullTime.home ?? "–"}
          </span>
        )}
      </div>
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1.5",
        awayWin && "bg-pitch/10",
      )}>
        <Flag name={awayName} />
        <span className={cn("flex-1 truncate text-[11px]", awayWin ? "font-bold text-ink" : "text-muted/90")}>
          {awayName ? teamZh(awayName) : <span className="italic text-muted/50">待定</span>}
        </span>
        {isFinished && (
          <span className={cn("font-display font-bold tabular-nums text-sm", awayWin ? "text-pitch" : "text-muted")}>
            {m.score.fullTime.away ?? "–"}
          </span>
        )}
      </div>
    </div>
  );
}

function Connector({ count, height }: { count: number; height: number }) {
  return (
    <div className="flex flex-col justify-around" style={{ height: `${height}px` }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="16" height="80" className="text-line/40" viewBox="0 0 16 80">
          <path d="M0 20 H8 V60 H0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ))}
    </div>
  );
}

/** 移动端折叠轮次 */
function CollapsibleRound({
  stage,
  list,
  defaultOpen,
}: {
  stage: KnockoutStage;
  list: MatchRaw[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const finishedCount = list.filter((m) => m.status === "FINISHED").length;
  const liveCount = list.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED").length;

  return (
    <div className="rounded-2xl border border-line/60 bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2/30"
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary-bright">
            {STAGE_COUNT[stage]}
          </span>
          <span className="font-display text-sm font-bold text-ink">{STAGE_ZH[stage]}</span>
        </div>
        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary-bright">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {liveCount}场进行中
            </span>
          )}
          {finishedCount > 0 && (
            <span className="text-[10px] text-muted">{finishedCount}/{list.length}场已赛</span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 py-3">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
            {list.map((m) => (
              <div key={m.id} className="snap-start">
                <MatchSlot m={m} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnockoutDraw({ matches }: { matches: MatchRaw[] }) {
  const byStage = useMemo(() => {
    const map = new Map<KnockoutStage, MatchRaw[]>();
    for (const s of STAGE_ORDER) map.set(s, []);
    for (const m of matches) {
      const s = m.stage as KnockoutStage;
      if (map.has(s)) map.get(s)!.push(m);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    return map;
  }, [matches]);

  const hasAnyData = useMemo(
    () => STAGE_ORDER.some((s) => (byStage.get(s)?.length ?? 0) > 0),
    [byStage],
  );

  if (!hasAnyData) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        淘汰赛赛程数据尚未产生
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeading kicker="对阵抽签" title="淘汰赛对阵图" />

      {/* 桌面端横向对阵图 */}
      <div className="hidden lg:block overflow-x-auto pb-4">
        <div className="flex gap-0 min-w-max items-start">
          {STAGE_ORDER.map((stage, stageIdx) => {
            const list = byStage.get(stage) ?? [];
            if (list.length === 0) return null;
            const slotH = 72;
            const totalH = list.length * (slotH + 8);
            return (
              <div key={stage} className="flex items-start">
                {stageIdx > 0 && <Connector count={list.length} height={totalH} />}
                <div className="flex flex-col" style={{ gap: `${Math.pow(2, stageIdx) * 8}px`, paddingTop: `${(Math.pow(2, stageIdx) - 1) * 40}px` }}>
                  <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-primary-bright">
                    {STAGE_ZH[stage]}
                  </div>
                  {list.map((m) => (
                    <MatchSlot key={m.id} m={m} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex items-center ml-6 mt-8">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-gold/50 bg-gold/10 p-4">
              <span className="text-3xl">🏆</span>
              <span className="text-[11px] font-semibold text-gold">大力神杯</span>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端：可折叠轮次导图 */}
      <div className="lg:hidden space-y-3">
        {STAGE_ORDER.map((stage, i) => {
          const list = byStage.get(stage) ?? [];
          if (list.length === 0) return null;
          // 默认展开前两轮（或包含进行中比赛的轮次）
          const hasLive = list.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
          const defaultOpen = i < 2 || hasLive;
          return (
            <CollapsibleRound
              key={stage}
              stage={stage}
              list={list}
              defaultOpen={defaultOpen}
            />
          );
        })}
      </div>
    </section>
  );
}
