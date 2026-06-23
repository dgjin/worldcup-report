import { motion } from "motion/react";
import type { ScorerRaw } from "../types/worldcup";
import { teamZh, playerZh, playerFaceUrl, flagUrl } from "../lib/teams";
import { Card, SectionHeading, cn } from "../components/ui";

const PODIUM = [
  { ring: "ring-gold", glow: "shadow-[0_0_30px_-6px_rgba(255,214,10,0.5)]", label: "text-gold", medal: "🥇" },
  { ring: "ring-slate-300", glow: "shadow-[0_0_24px_-8px_rgba(203,213,225,0.4)]", label: "text-slate-300", medal: "🥈" },
  { ring: "ring-amber-700", glow: "shadow-[0_0_24px_-8px_rgba(180,83,9,0.4)]", label: "text-amber-600", medal: "🥉" },
];

function PlayerAvatar({ scorer, size = "md" }: { scorer: ScorerRaw; size?: "sm" | "md" | "lg" }) {
  const faceUrl = playerFaceUrl(scorer.player.id, scorer.player.name, scorer.team.name);
  const flag = flagUrl(scorer.team.name);
  const dim = size === "lg" ? "h-14 w-14 sm:h-20 sm:w-20" : size === "md" ? "h-14 w-14" : "h-9 w-9";
  const flagDim = size === "lg" ? "h-4 w-6 sm:h-5 sm:w-7" : "h-3.5 w-5";
  return (
    <div className={cn("relative shrink-0", dim)}>
      <img
        src={faceUrl}
        alt={playerZh(scorer.player.id, scorer.player.name)}
        loading="lazy"
        className={cn("rounded-full object-cover ring-2 ring-line/60 bg-surface-2", dim)}
      />
      {flag && (
        <img
          src={flag}
          alt=""
          className={cn("absolute -bottom-0.5 -right-0.5 rounded-[2px] object-cover shadow ring-1 ring-black/30", flagDim)}
        />
      )}
    </div>
  );
}

function PodiumCard({ scorer, rank }: { scorer: ScorerRaw; rank: number }) {
  const s = PODIUM[rank];
  const zhName = playerZh(scorer.player.id, scorer.player.name);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08, duration: 0.4 }}
    >
      <Card className={cn("relative flex flex-col items-center gap-1.5 px-1.5 py-3 ring-1 sm:gap-3 sm:px-4 sm:py-5", s.ring, s.glow)}>
        <span className="absolute right-1.5 top-1.5 text-base sm:right-3 sm:top-3 sm:text-2xl">{s.medal}</span>
        <PlayerAvatar scorer={scorer} size="lg" />
        <div className="w-full text-center">
          <div className="truncate font-display text-xs font-bold text-ink sm:text-base">{zhName}</div>
          <div className="hidden truncate text-xs text-muted sm:block">{scorer.player.name}</div>
          <div className="truncate text-[10px] text-muted sm:text-xs">{teamZh(scorer.team.name)}</div>
        </div>
        <div className={cn("font-display text-2xl font-bold tabular-nums sm:text-4xl", s.label)}>{scorer.goals}</div>
        <div className="text-[9px] tracking-widest text-muted sm:text-[11px]">进球</div>
        {scorer.penalties ? <div className="hidden text-[11px] text-muted sm:block">含点球 {scorer.penalties}</div> : null}
      </Card>
    </motion.div>
  );
}

export default function Scorers({ scorers }: { scorers: ScorerRaw[] }) {
  const top3 = scorers.slice(0, 3);
  const rest = scorers.slice(3);
  const maxGoals = scorers[0]?.goals || 1;

  return (
    <section>
      <SectionHeading kicker="金靴奖" title="射手榜" />
      {top3.length === 3 && (
        <div className="mb-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
          {/* 银-金-铜 视觉排序：金牌居中抬高 */}
          <div className="order-1 mt-3 sm:mt-6">
            <PodiumCard scorer={top3[1]} rank={1} />
          </div>
          <div className="order-2">
            <PodiumCard scorer={top3[0]} rank={0} />
          </div>
          <div className="order-3 mt-3 sm:mt-6">
            <PodiumCard scorer={top3[2]} rank={2} />
          </div>
        </div>
      )}

      <Card className="divide-y divide-line/50">
        {rest.map((scorer, i) => {
          const zhName = playerZh(scorer.player.id, scorer.player.name);
          return (
            <div key={scorer.player.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 text-center font-display text-sm font-bold text-muted tabular-nums">{i + 4}</span>
              <PlayerAvatar scorer={scorer} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{zhName}</div>
                <div className="text-[11px] text-muted">{zhName !== scorer.player.name ? scorer.player.name + " · " : ""}{teamZh(scorer.team.name)}</div>
              </div>
              <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-surface-2 sm:block">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold" style={{ width: `${(scorer.goals / maxGoals) * 100}%` }} />
              </div>
              <div className="flex w-16 items-baseline justify-end gap-1">
                <span className="font-display text-lg font-bold text-ink tabular-nums">{scorer.goals}</span>
                <span className="text-[10px] text-muted">球</span>
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
