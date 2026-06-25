import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Info, Trophy, ChevronDown, HeartPulse, Swords, TrendingUp } from "lucide-react";
import type { GroupTable, MatchRaw } from "../types/worldcup";
import { predictChampions, type ChampionPick } from "../lib/prediction";
import { Card, Flag, SectionHeading, cn } from "../components/ui";
import { SQUAD_VALUE, FIFA_RANK } from "../lib/prediction-data";

// 9 维配置
const DIMS: {
  key: keyof Pick<ChampionPick, "fifa" | "squadValue" | "form" | "pedigree" | "attack" | "defense" | "injury" | "bigMatch" | "momentum">;
  label: string;
  tone: string;
  icon?: typeof Crown;
}[] = [
  { key: "fifa", label: "FIFA", tone: "bg-violet-400" },
  { key: "squadValue", label: "身价", tone: "bg-gold" },
  { key: "form", label: "状态", tone: "bg-pitch" },
  { key: "pedigree", label: "底蕴", tone: "bg-amber-600" },
  { key: "attack", label: "攻击", tone: "bg-primary" },
  { key: "defense", label: "防守", tone: "bg-sky-400" },
  { key: "injury", label: "健康", tone: "bg-emerald-400" },
  { key: "bigMatch", label: "大赛", tone: "bg-rose-400" },
  { key: "momentum", label: "势头", tone: "bg-orange-400" },
];

function DimBar({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon?: typeof Crown }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex w-12 shrink-0 items-center gap-0.5 text-[10px] text-muted">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted">{value}</span>
    </div>
  );
}

/** 伤病信息卡 */
function InjuryAlert({ injuries }: { injuries: ChampionPick["injuries"] }) {
  if (!injuries || injuries.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {injuries.map((inj, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px]">
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              inj.status === "out" ? "bg-red-500" : inj.status === "doubtful" ? "bg-amber-400" : "bg-emerald-400",
            )}
          />
          <span className="font-medium text-ink/70">{inj.player}</span>
          <span className="text-muted">{inj.detail}</span>
        </div>
      ))}
    </div>
  );
}

/** 知识库信息：身价 + FIFA 排名 */
function KnowledgeTag({ zh }: { zh: string }) {
  const value = SQUAD_VALUE[zh];
  const rank = FIFA_RANK[zh];
  return (
    <div className="flex flex-wrap gap-1">
      {value && (
        <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[9px] font-medium text-gold">
          €{(value / 1000).toFixed(2)}B
        </span>
      )}
      {rank && (
        <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
          FIFA #{rank}
        </span>
      )}
    </div>
  );
}

function TopPick({ p, rank }: { p: ChampionPick; rank: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="relative overflow-hidden ring-1 ring-gold/45 shadow-[0_0_36px_-10px_rgba(255,214,10,0.5)]">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold/10 blur-2xl" />
        <div className="flex items-center gap-3 border-b border-gold/20 bg-gradient-to-r from-gold/[0.12] to-transparent px-4 py-3">
          <Crown className="h-5 w-5 shrink-0 text-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gold">夺冠热门 #{rank}</span>
          {p.host && <span className="rounded-full bg-pitch/15 px-2 py-0.5 text-[10px] font-semibold text-pitch">东道主</span>}
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Flag name={p.name} className="!h-11 !w-[4.1rem] shadow-md ring-1 ring-gold/30" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-bold text-ink">{p.zh}</div>
            <div className="mt-0.5">
              <KnowledgeTag zh={p.zh} />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
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
        {/* 9 维雷达 */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line/40 px-4 py-3 sm:grid-cols-2">
          {DIMS.map((d) => (
            <DimBar key={d.key} label={d.label} value={p[d.key]} tone={d.tone} icon={d.icon} />
          ))}
        </div>
        {/* 伤病信息 */}
        <InjuryAlert injuries={p.injuries} />
      </Card>
    </motion.div>
  );
}

function Row({ p, rank, maxProb, expanded, onToggle }: {
  p: ChampionPick; rank: number; maxProb: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-lg">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-lg bg-surface/40 px-2.5 py-2 transition-colors hover:bg-surface/60"
      >
        <span className="w-4 shrink-0 text-center font-display text-sm font-bold text-muted tabular-nums">{rank}</span>
        <Flag name={p.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-ink">{p.zh}</span>
            {p.host && <span className="shrink-0 rounded bg-pitch/15 px-1 text-[9px] font-semibold text-pitch">东</span>}
            {p.injury < 90 && (
              <span className="shrink-0 rounded bg-amber-400/15 px-1 text-[9px] font-semibold text-amber-400">伤</span>
            )}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-gold"
              style={{ width: `${maxProb > 0 ? (p.prob / maxProb) * 100 : 0}%` }}
            />
          </div>
        </div>
        <span className="w-12 shrink-0 text-right font-display text-sm font-bold text-ink tabular-nums">{p.prob.toFixed(1)}%</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 px-3 pb-2 pt-1.5">
              <div className="flex flex-wrap gap-1 pb-1">
                <KnowledgeTag zh={p.zh} />
              </div>
              {DIMS.map((d) => (
                <DimBar key={d.key} label={d.label} value={p[d.key]} tone={d.tone} icon={d.icon} />
              ))}
              <InjuryAlert injuries={p.injuries} />
              {p.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-surface-2/60 px-1.5 py-0.5 text-[9px] text-muted">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChampionPrediction({ groups, matches }: { groups: GroupTable[]; matches?: MatchRaw[] }) {
  const picks = useMemo(
    () => predictChampions(groups, matches ?? [], 8),
    [groups, matches],
  );
  const [showMethod, setShowMethod] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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
        kicker="9 维推演 · 实时+知识库"
        title="冠军预测"
        right={
          <button
            onClick={() => setShowMethod((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-line/60 px-2 py-1 text-[10px] text-muted transition-colors hover:text-ink"
          >
            <Info className="h-3 w-3" />
            模型说明
          </button>
        }
      />

      {showMethod && (
        <div className="mb-3 rounded-xl border border-line/50 bg-surface/40 p-3 text-[11px] leading-relaxed text-muted">
          <div className="mb-1.5 flex items-center gap-1.5 font-medium text-ink">
            <TrendingUp className="h-3 w-3" /> 实时数据（API）
          </div>
          <span className="text-pitch">小组赛状态</span>(14%)、
          <span className="text-primary-bright">攻击效率</span>(8%)、
          <span className="text-sky-400">防守稳固</span>(8%)、
          <span className="text-orange-400">近 3 场势头</span>(8%)
          <div className="mb-1.5 mt-2 flex items-center gap-1.5 font-medium text-ink">
            <Swords className="h-3 w-3" /> 知识库数据
          </div>
          <span className="text-violet-300">FIFA 排名</span>(18%)、
          <span className="text-gold">阵容身价</span>(16%)、
          <span className="text-amber-500">世界杯底蕴</span>(10%)、
          <span className="text-emerald-400">伤病跟踪</span>(10%)、
          <span className="text-rose-400">大赛经验</span>(8%)
          <div className="mt-2 flex items-center gap-1.5">
            <HeartPulse className="h-3 w-3" /> 东道主加分 +4
          </div>
          <div className="mt-2 text-[10px] text-muted/70">
            数据来源：football-data.org 实时 API · Transfermarkt 身价（2026.06）· FIFA 排名（2026.06）·
            世界杯历史（FIFA 官方）· 伤病跟踪（ESPN/BBC/Sky Sports）
            <br />
            模型随赛况实时更新，<span className="text-ink">仅供参考娱乐</span>。
          </div>
        </div>
      )}

      <div className="space-y-3">
        <TopPick p={top} rank={1} />
        <Card className="space-y-1 p-2">
          <div className="flex items-center gap-1.5 px-1.5 pb-0.5 pt-1 text-[11px] font-semibold text-muted">
            <Trophy className="h-3 w-3" />
            其他争冠热门
            <span className="ml-auto text-[10px] font-normal text-muted/60">点击展开详情</span>
          </div>
          {rest.map((p, i) => (
            <Row
              key={p.name}
              p={p}
              rank={i + 2}
              maxProb={maxProb}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
