import { useMemo, useState, type ReactNode } from "react";
import type { MatchRaw } from "../types/worldcup";
import { teamZh, flagUrl } from "../lib/teams";
import { Card, Flag, SectionHeading, cn } from "../components/ui";
import { timeLabel } from "../lib/format";
import { ChevronDown } from "lucide-react";
import { useThemeColors } from "../lib/theme";

const STAGE_ORDER = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"] as const;
type KnockoutStage = (typeof STAGE_ORDER)[number];

const STAGE_ZH: Record<KnockoutStage, string> = {
  LAST_32: "32强",
  LAST_16: "16强",
  QUARTER_FINALS: "1/4决赛",
  SEMI_FINALS: "半决赛",
  THIRD_PLACE: "季军赛",
  FINAL: "决赛",
};

const STAGE_COUNT: Record<KnockoutStage, number> = {
  LAST_32: 16,
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  THIRD_PLACE: 1,
  FINAL: 1,
};

/* ===================== 桌面端：SVG 中心收敛对阵图 ===================== */

const ROUND_STAGES: KnockoutStage[] = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS"];
const PER_SIDE = [8, 4, 2, 1]; // R32 / R16 / QF / SF 每侧数量

function SvgBracket({ byStage }: { byStage: Map<KnockoutStage, MatchRaw[]> }) {
  const C = useThemeColors();
  const BW = 142;
  const BH = 46;
  const COLGAP = 30;
  const VGAP = 16;
  const TOP = 48;
  const PAD = 16;

  const W = PAD * 2 + 9 * BW + 8 * COLGAP;
  const H = TOP + 8 * BH + 7 * VGAP + PAD;
  const finalX = PAD + 4 * (BW + COLGAP);

  // 预计算所有坐标 + 生成全部 SVG 元素（单个 useMemo，消除递归重复计算）
  const { boxes, paths, labels, finalBox, centerY, champName } = useMemo(() => {
    const r32CY = (i: number) => TOP + i * (BH + VGAP) + BH / 2;
    const cy = (round: number, idx: number): number =>
      round === 0 ? r32CY(idx) : (cy(round - 1, idx * 2) + cy(round - 1, idx * 2 + 1)) / 2;
    const leftX = (round: number) => PAD + round * (BW + COLGAP);
    const rightX = (round: number) => W - PAD - BW - round * (BW + COLGAP);

    const centers: number[][] = [];
    const sides: { left: MatchRaw[]; right: MatchRaw[] }[] = [];
    for (let round = 0; round <= 3; round++) {
      centers[round] = [];
      const perSide = PER_SIDE[round];
      for (let idx = 0; idx < perSide; idx++) {
        centers[round][idx] = cy(round, idx);
      }
      const list = byStage.get(ROUND_STAGES[round]) ?? [];
      sides[round] = { left: list.slice(0, perSide), right: list.slice(perSide, perSide * 2) };
    }
    const centerY = centers[3][0];

    function row(name: string | null, yOff: number, win: boolean, score: number | null) {
      const url = name ? flagUrl(name) : null;
      const tx = url ? 30 : 9;
      return (
        <>
          {url && <image href={url} x={9} y={yOff + (BH / 2 - 12) / 2} width={18} height={12} preserveAspectRatio="xMidYMid slice" />}
          <text x={tx} y={yOff + BH / 4 + 4} fontSize={11.5} fill={win ? C.ink : C.muted} fontWeight={win ? 700 : 500} fontStyle={name ? "normal" : "italic"}>
            {name ? teamZh(name) : "待定"}
          </text>
          {score != null && (
            <text x={BW - 9} y={yOff + BH / 4 + 4} fontSize={12} textAnchor="end" fill={win ? C.pitch : C.muted} fontWeight={700} fontFamily="Oswald, sans-serif">
              {score}
            </text>
          )}
        </>
      );
    }

    function box(key: string, x: number, y: number, m: MatchRaw | null, gold = false) {
      const live = m?.status === "IN_PLAY" || m?.status === "PAUSED";
      const finished = m?.status === "FINISHED";
      const homeWin = !!finished && m?.score.winner === "HOME_TEAM";
      const awayWin = !!finished && m?.score.winner === "AWAY_TEAM";
      return (
        <g key={key} transform={`translate(${x},${y})`}>
          <rect width={BW} height={BH} rx={7} fill={C.surface} fillOpacity={0.9} stroke={live ? C.primary : gold ? C.gold : C.line} strokeWidth={live || gold ? 1.6 : 1} />
          <text x={BW - 8} y={10} fontSize={8.5} textAnchor="end" fill={C.muted} fontWeight={700}>M{m?.id ?? ""}</text>
          <line x1={0} y1={BH / 2} x2={BW} y2={BH / 2} stroke={C.line} strokeOpacity={0.6} />
          {row(m?.homeTeam?.name ?? null, 0, homeWin, finished ? m!.score.fullTime.home : null)}
          {row(m?.awayTeam?.name ?? null, BH / 2, awayWin, finished ? m!.score.fullTime.away : null)}
        </g>
      );
    }

    const boxes: ReactNode[] = [];
    const paths: ReactNode[] = [];
    const labels: ReactNode[] = [];

    for (let round = 0; round <= 3; round++) {
      const { left, right } = sides[round];
      const perSide = PER_SIDE[round];
      for (let idx = 0; idx < perSide; idx++) {
        const c = centers[round][idx];
        boxes.push(box(`L${round}-${idx}`, leftX(round), c - BH / 2, left[idx] ?? null));
        boxes.push(box(`R${round}-${idx}`, rightX(round), c - BH / 2, right[idx] ?? null));
      }
      labels.push(
        <text key={`ll${round}`} x={leftX(round) + BW / 2} y={TOP - 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={C["primary-bright"]}>{STAGE_ZH[ROUND_STAGES[round]]}</text>,
        <text key={`lr${round}`} x={rightX(round) + BW / 2} y={TOP - 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={C["primary-bright"]}>{STAGE_ZH[ROUND_STAGES[round]]}</text>,
      );
    }

    for (let round = 1; round <= 3; round++) {
      for (let idx = 0; idx < PER_SIDE[round]; idx++) {
        const c1 = centers[round - 1][idx * 2];
        const c2 = centers[round - 1][idx * 2 + 1];
        const pcy = centers[round][idx];
        const lcx = leftX(round - 1) + BW, lpx = leftX(round), lm = (lcx + lpx) / 2;
        paths.push(<path key={`pl${round}-${idx}`} d={`M${lcx},${c1} H${lm} V${c2} M${lcx},${c2} H${lm} M${lm},${pcy} H${lpx}`} fill="none" stroke={C.line} strokeWidth={1.2} />);
        const rcx = rightX(round - 1), rpx = rightX(round) + BW, rm = (rcx + rpx) / 2;
        paths.push(<path key={`pr${round}-${idx}`} d={`M${rcx},${c1} H${rm} V${c2} M${rcx},${c2} H${rm} M${rm},${pcy} H${rpx}`} fill="none" stroke={C.line} strokeWidth={1.2} />);
      }
    }
    paths.push(<path key="fl" d={`M${leftX(3) + BW},${centerY} H${finalX}`} fill="none" stroke={C.line} strokeWidth={1.2} />);
    paths.push(<path key="fr" d={`M${rightX(3)},${centerY} H${finalX + BW}`} fill="none" stroke={C.line} strokeWidth={1.2} />);

    const finalMatch = byStage.get("FINAL")?.[0] ?? null;
    const finalBox = box("FINAL", finalX, centerY - BH / 2, finalMatch, true);
    const champName = finalMatch?.status === "FINISHED"
      ? finalMatch.score.winner === "HOME_TEAM" ? finalMatch.homeTeam?.name : finalMatch.score.winner === "AWAY_TEAM" ? finalMatch.awayTeam?.name : null
      : null;

    return { boxes, paths, labels, finalBox, centerY, champName };
  }, [byStage, C, BW, BH, COLGAP, VGAP, TOP, PAD, W, finalX]);

  return (
    <div className="hidden overflow-x-auto pb-2 lg:block">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 1000 }} role="img" aria-label="淘汰赛对阵图">
        {paths}
        {boxes}
        {labels}
        <text x={finalX + BW / 2} y={TOP - 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.gold}>决赛</text>
        <text x={finalX + BW / 2} y={centerY - BH / 2 - 12} textAnchor="middle" fontSize={22}>🏆</text>
        <text x={finalX + BW / 2} y={centerY + BH / 2 + 22} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.gold}>
          {champName ? `🏆 ${teamZh(champName)}` : "大力神杯"}
        </text>
        {finalBox}
      </svg>
    </div>
  );
}

/* ===================== 移动端：折叠轮次（SVG 太宽不适合手机） ===================== */

function MatchSlot({ m, compact = false }: { m: MatchRaw; compact?: boolean }) {
  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const homeName = m.homeTeam?.name ?? null;
  const awayName = m.awayTeam?.name ?? null;
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
      <div className={cn("px-2 py-0.5 text-center text-[9px] font-semibold", isLive ? "bg-primary/20 text-primary-bright" : "bg-surface-2/50 text-muted")}>
        M{m.id} · {isLive ? "进行中" : isFinished ? "已完赛" : timeLabel(m.utcDate)}
      </div>
      <div className={cn("flex items-center gap-1.5 border-b border-line/40 px-2 py-1.5", homeWin && "bg-pitch/10")}>
        <Flag name={homeName} />
        <span className={cn("flex-1 truncate text-[11px]", homeWin ? "font-bold text-ink" : "text-muted/90")}>
          {homeName ? teamZh(homeName) : <span className="italic text-muted/50">待定</span>}
        </span>
        {isFinished && <span className={cn("font-display text-sm font-bold tabular-nums", homeWin ? "text-pitch" : "text-muted")}>{m.score.fullTime.home ?? "–"}</span>}
      </div>
      <div className={cn("flex items-center gap-1.5 px-2 py-1.5", awayWin && "bg-pitch/10")}>
        <Flag name={awayName} />
        <span className={cn("flex-1 truncate text-[11px]", awayWin ? "font-bold text-ink" : "text-muted/90")}>
          {awayName ? teamZh(awayName) : <span className="italic text-muted/50">待定</span>}
        </span>
        {isFinished && <span className={cn("font-display text-sm font-bold tabular-nums", awayWin ? "text-pitch" : "text-muted")}>{m.score.fullTime.away ?? "–"}</span>}
      </div>
    </div>
  );
}

function CollapsibleRound({ stage, list, defaultOpen }: { stage: KnockoutStage; list: MatchRaw[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const finishedCount = list.filter((m) => m.status === "FINISHED").length;
  const liveCount = list.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line/60 bg-surface/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-surface-2/30">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary-bright">{STAGE_COUNT[stage]}</span>
          <span className="font-display text-sm font-bold text-ink">{STAGE_ZH[stage]}</span>
        </div>
        <div className="flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary-bright">
              <span className="live-dot h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {liveCount}场进行中
            </span>
          )}
          {finishedCount > 0 && <span className="text-[10px] text-muted">{finishedCount}/{list.length}场已赛</span>}
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 py-3">
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
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
  const displayMatches = matches;
  const byStage = useMemo(() => {
    const map = new Map<KnockoutStage, MatchRaw[]>();
    for (const s of STAGE_ORDER) map.set(s, []);
    for (const m of displayMatches) {
      const s = m.stage as KnockoutStage;
      if (map.has(s)) map.get(s)!.push(m);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    return map;
  }, [displayMatches]);

  return (
    <section className="space-y-4">
      <SectionHeading
        kicker="对阵抽签"
        title="淘汰赛对阵图"
        right={<span className="text-[11px] text-muted">左右分区 · 决赛居中</span>}
      />

      {/* 桌面端：SVG 中心收敛对阵图 */}
      <SvgBracket byStage={byStage} />

      {/* 移动端：可折叠轮次 */}
      <div className="space-y-3 lg:hidden">
        {STAGE_ORDER.map((stage, i) => {
          const list = byStage.get(stage) ?? [];
          if (list.length === 0) return null;
          const hasLive = list.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
          return <CollapsibleRound key={stage} stage={stage} list={list} defaultOpen={i < 2 || hasLive} />;
        })}
        {STAGE_ORDER.every((s) => (byStage.get(s)?.length ?? 0) === 0) && (
          <Card className="p-6 text-center text-sm text-muted">淘汰赛赛程数据尚未产生</Card>
        )}
      </div>
    </section>
  );
}
