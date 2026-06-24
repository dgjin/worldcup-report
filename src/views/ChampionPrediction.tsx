import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Crown, Info, Trophy } from "lucide-react";
import type { GroupTable } from "../types/worldcup";
import { predictChampions, type ChampionPick } from "../lib/prediction";
import { Card, Flag, SectionHeading, cn } from "../components/ui";

const DIMS: { key: keyof Pick<ChampionPick, "pedigree" | "form" | "attack" | "defense">; label: string; tone: string }[] = [
  { key: "pedigree", label: "底蕴", tone: "bg-gold" },
  { key: "form", label: "状态", tone: "bg-pitch" },
  { key: "attack", label: "攻击", tone: "bg-primary" },
  { key: "defense", label: "防守", tone: "bg-sky-400" },
];

function DimBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 shrink-0 text-[10px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted">{value}</span>
    </div>
  );
}

function TopPick({ p }: { p: ChampionPick }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative overflow-hidden ring-1 ring-gold/45 shadow-[0_0_36px_-10px_rgba(255,214,10,0.5)]">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl" />
        <div className="flex items-center gap-3 border-b border-gold/20 bg-gradient-to-r from-gold/[0.12] to-transparent px-4 py-3">
          <Crown className="h-5 w-5 shrink-0 text-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gold">夺冠热门</span>
          {p.host && <span className="rounded-full bg-pitch/15 px-2 py-0.5 text-[10px] font-semibold text-pitch">东道主</span>}
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Flag name={p.name} className="!h-11 !w-[4.1rem] shadow-md ring-1 ring-gold/30" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-bold text-ink">{p.zh}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {p.reasons.map((r) => (
                <span key={r} className="rounded-full bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-muted">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-3xl font-bold leading-none text-gold tabular-nums">{p.prob.toFixed(1)}%</div>
            <div className="mt-0.5 text-[10px] text-muted">夺冠概率</div>
          </div>
        </div>
        <div className="space-y-1.5 px-4 pb-4">
          {DIMS.map((d) => (
            <DimBar key={d.key} label={d.label} value={p[d.key]} tone={d.tone} />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function Row({ p, rank, maxProb }: { p: ChampionPick; rank: number; maxProb: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.3), duration: 0.3 }}
      className="flex items-center gap-2.5 rounded-lg bg-surface/40 px-2.5 py-2"
    >
      <span className="w-4 shrink-0 text-center font-display text-sm font-bold text-muted tabular-nums">{rank}</span>
      <Flag name={p.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">{p.zh}</span>
          {p.host && <span className="shrink-0 rounded bg-pitch/15 px-1 text-[9px] font-semibold text-pitch">东</span>}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-gold"
            style={{ width: `${maxProb > 0 ? (p.prob / maxProb) * 100 : 0}%` }}
          />
        </div>
      </div>
      <span className="w-12 shrink-0 text-right font-display text-sm font-bold text-ink tabular-nums">{p.prob.toFixed(1)}%</span>
    </motion.div>
  );
}

export default function ChampionPrediction({ groups }: { groups: GroupTable[] }) {
  const picks = useMemo(() => predictChampions(groups, 8), [groups]);
  const [showMethod, setShowMethod] = useState(false);

  if (picks.length === 0) {
    return (
      <div>
        <SectionHeading kicker="AI 推演" title="冠军预测" />
        <Card className="p-6 text-center text-sm text-muted">暂无数据，无法预测</Card>
      </div>
    );
  }

  const [top, ...rest] = picks;
  const maxProb = picks[0].prob;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeading
        kicker="多维度推演"
        title="冠军预测"
        right={
          <button
            onClick={() => setShowMethod((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-line/60 px-2 py-1 text-[10px] text-muted transition-colors hover:text-ink"
          >
            <Info className="h-3 w-3" />
            分析维度
          </button>
        }
      />

      {showMethod && (
        <div className="mb-3 rounded-xl border border-line/50 bg-surface/40 p-3 text-[11px] leading-relaxed text-muted">
          综合 <span className="text-gold">阵容底蕴/身价/大赛经验</span>（维度 2·5·13）、
          <span className="text-pitch">小组形势与近期状态</span>（1·3）、
          <span className="text-primary-bright">进攻效率</span>（12）、
          <span className="text-sky-400">防守稳固度</span>（11）、
          <span className="text-pitch">东道主效应</span>（6）加权；伤病、气候、赛程体能、战术风格、舆论氛围等数据有限维度已并入底蕴评估。
          模型随实时赛况更新，<span className="text-ink">仅供参考娱乐</span>。
        </div>
      )}

      <div className="space-y-3">
        <TopPick p={top} />
        <Card className="space-y-1.5 p-2">
          <div className="flex items-center gap-1.5 px-1.5 pb-0.5 pt-1 text-[11px] font-semibold text-muted">
            <Trophy className="h-3 w-3" />
            其他争冠热门
          </div>
          {rest.map((p, i) => (
            <Row key={p.name} p={p} rank={i + 2} maxProb={maxProb} />
          ))}
        </Card>
      </div>
    </div>
  );
}
