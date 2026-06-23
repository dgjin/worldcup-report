import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { SplitMatches } from "../types/worldcup";
import { buildReports, type ReportItem } from "../lib/report";
import { dayLabel } from "../lib/format";
import { teamZh } from "../lib/teams";
import { Card, Flag, SectionHeading, Tag, cn } from "../components/ui";

function tagTone(tag: string): "default" | "hot" | "gold" | "cool" {
  if (tag === "爆冷") return "hot";
  if (tag === "进球大战") return "cool";
  if (tag === "血洗" || tag === "大胜" || tag === "一球小胜") return "gold";
  return "default";
}

function ReportCard({ item, index }: { item: ReportItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.25), duration: 0.3 }}
    >
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-primary/20 px-1.5 py-0.5 font-semibold text-primary-bright">小组 {item.group}</span>
            {dayLabel(item.date)}
          </span>
          <span className="flex items-center gap-2">
            <Flag name={item.home.name} />
            <span className="font-display text-base font-bold text-ink tabular-nums">
              {item.homeScore} - {item.awayScore}
            </span>
            <Flag name={item.away.name} />
          </span>
        </div>
        <h3 className="font-display text-lg font-bold text-ink">{item.headline}</h3>
        <div className="mt-1 text-xs text-muted">
          {teamZh(item.home.name)} 对阵 {teamZh(item.away.name)}
        </div>
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <Tag key={t} tone={tagTone(t)}>
                {t}
              </Tag>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function MatchReport({ matches }: { matches: SplitMatches }) {
  const reports = useMemo(() => buildReports(matches.all), [matches.all]);
  const allTags = useMemo(() => Array.from(new Set(reports.flatMap((r) => r.tags))), [reports]);
  const [filter, setFilter] = useState<string | null>(null);

  const shown = filter ? reports.filter((r) => r.tags.includes(filter)) : reports;

  return (
    <section>
      <SectionHeading
        kicker="战报速递"
        title="赛事亮点战报"
        right={<span className="text-[11px] text-muted">{reports.length} 场已赛</span>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors",
            filter === null ? "bg-primary text-white ring-primary" : "bg-surface/50 text-muted ring-line hover:text-ink",
          )}
        >
          全部
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors",
              filter === t ? "bg-primary text-white ring-primary" : "bg-surface/50 text-muted ring-line hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((item, i) => (
          <ReportCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
