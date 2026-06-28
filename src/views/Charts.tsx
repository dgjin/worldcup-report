import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GroupTable, ScorerRaw, SplitMatches } from "../types/worldcup";
import {
  allTeamStats,
  cleanSheetLeaders,
  comebackCount,
  goalsByGroup,
  goalsByMatchday,
  halfTimeGoals,
} from "../lib/transform";
import { teamZh, playerZh, flagUrl } from "../lib/teams";
import { Card, SectionHeading, cn } from "../components/ui";
import { useThemeColors } from "../lib/theme";

/* ───── 统一样式的数据卡片 ───── */
const cardBase = "px-4 py-3 flex flex-col justify-center min-h-[5.5rem]";

function StatTile({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone: string }) {
  return (
    <Card className={cardBase}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tabular-nums" style={{ color: tone }}>{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Card className={cardBase}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tabular-nums text-ink">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
    </Card>
  );
}

function TeamSuperlative({ label, icon, teamName, value, unit, tone }: { label: string; icon: string; teamName: string; value: number; unit: string; tone: string }) {
  const flag = flagUrl(teamName);
  return (
    <Card className={cardBase}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{icon} {label}</div>
      <div className="mt-1 flex items-center gap-2">
        {flag && <img src={flag} alt="" className="h-5 w-7 shrink-0 rounded-[2px] object-cover shadow" />}
        <span className="truncate text-sm font-semibold text-ink">{teamZh(teamName)}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-xl font-bold" style={{ color: tone }}>{value}</span>
        <span className="text-[11px] text-muted">{unit}</span>
      </div>
    </Card>
  );
}

/* ───── 主组件 ───── */

export default function Charts({ groups, matches, scorers }: { groups: GroupTable[]; matches: SplitMatches; scorers: ScorerRaw[] }) {
  const C = useThemeColors();
  const tt = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, fontSize: 12 };

  const byGroup = goalsByGroup(groups);
  const byMatchday = goalsByMatchday(matches.finished);
  const teamStats = useMemo(() => allTeamStats(groups), [groups]);
  const ht = useMemo(() => halfTimeGoals(matches.finished), [matches.finished]);
  const comebacks = useMemo(() => comebackCount(matches.finished), [matches.finished]);
  const cleanSheets = useMemo(() => cleanSheetLeaders(matches.finished, 5), [matches.finished]);

  const totalGoals = matches.finished.reduce((sum, m) => sum + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0), 0);
  const played = matches.finished.length;
  const avg = played ? (totalGoals / played).toFixed(2) : "0";
  const biggest = matches.finished.reduce((b, m) => {
    const d = Math.abs((m.score.fullTime.home ?? 0) - (m.score.fullTime.away ?? 0));
    return d > b.diff ? { diff: d, text: `${m.score.fullTime.home}-${m.score.fullTime.away}`, who: teamZh((m.score.fullTime.home ?? 0) >= (m.score.fullTime.away ?? 0) ? m.homeTeam.name : m.awayTeam.name) } : b;
  }, { diff: 0, text: "—", who: "" });

  const bestAttack = [...teamStats].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const mostConceded = [...teamStats].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0];
  const mostWins = [...teamStats].sort((a, b) => b.wins - a.wins)[0];
  const mostDraws = [...teamStats].sort((a, b) => b.draws - a.draws)[0];
  const topClean = cleanSheets[0];

  // 射手榜：仅使用真实 API 数据（Top 30，排名准确但非全量）
  const topScorers = scorers.slice(0, 8).map((s) => ({
    name: playerZh(s.player.id, s.player.name),
    team: teamZh(s.team.name),
    teamRaw: s.team.name,
    goals: s.goals,
    penalties: s.penalties,
    playerId: s.player.id,
  }));
  const scorerColors = [C.gold, C.primary, C.primary, C.pitch, C.muted, C.muted, C.muted, C.muted];

  return (
    <section className="space-y-6">
      <SectionHeading kicker="数据统计" title="数据总览" />

      {/* 1. 核心概览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="总进球" value={totalGoals} unit="球" tone={C.gold} />
        <StatTile label="已赛场次" value={played} unit="场" tone={C.ink} />
        <StatTile label="场均进球" value={avg} unit="球/场" tone={C.pitch} />
        <StatTile label="最大分差" value={biggest.text} unit={biggest.who} tone={C.primary} />
      </div>

      {/* 2. 半场分析 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MiniStat label="上半场进球" value={ht.firstHalf} unit={`${Math.round((ht.firstHalf / Math.max(ht.total, 1)) * 100)}%`} />
        <MiniStat label="下半场进球" value={ht.secondHalf} unit={`${Math.round((ht.secondHalf / Math.max(ht.total, 1)) * 100)}%`} />
        <MiniStat label="逆转场次" value={comebacks} unit="场" />
      </div>

      {/* 3. 球队之最 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {bestAttack && <TeamSuperlative label="进球最多" icon="🔥" teamName={bestAttack.name} value={bestAttack.goalsFor} unit="球" tone={C.gold} />}
        {mostConceded && <TeamSuperlative label="失球最多" icon="🥅" teamName={mostConceded.name} value={mostConceded.goalsAgainst} unit="球" tone={C["primary-bright"]} />}
        {mostWins && <TeamSuperlative label="胜场最多" icon="🏆" teamName={mostWins.name} value={mostWins.wins} unit="胜" tone={C.pitch} />}
        {mostDraws && <TeamSuperlative label="平局最多" icon="🤝" teamName={mostDraws.name} value={mostDraws.draws} unit="平" tone={C.muted} />}
        {topClean && <TeamSuperlative label="零封最多" icon="🧤" teamName={topClean.name} value={topClean.cleanSheets} unit="场" tone="#60a5fa" />}
      </div>

      {/* 4. 图表 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 font-display text-base font-semibold text-ink">各小组总进球</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byGroup} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="group" stroke={C.muted} fontSize={12} tickLine={false} />
              <YAxis stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} cursor={{ fill: "rgba(128,128,128,0.12)" }} />
              <Bar dataKey="goals" name="进球" radius={[4, 4, 0, 0]}>
                {byGroup.map((d) => (<Cell key={d.group} fill={d.goals >= 12 ? C.gold : C.primary} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-display text-base font-semibold text-ink">各轮进球数</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byMatchday} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="matchday" stroke={C.muted} fontSize={12} tickLine={false} />
              <YAxis stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} cursor={{ fill: "rgba(128,128,128,0.12)" }} />
              <Bar dataKey="goals" name="进球" fill={C.pitch} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 5. 射手榜 Top 8（数据来自 football-data.org scorers 端点） */}
      <Card className="p-4">
        <h3 className="mb-4 font-display text-base font-semibold text-ink">⚽ 射手榜 Top 8</h3>
        <div className="divide-y divide-line/40">
          {topScorers.map((s, i) => (
            <div key={s.playerId} className="flex items-center gap-2 py-2">
              <span className={cn("w-5 shrink-0 text-center font-display text-sm font-bold tabular-nums", i === 0 ? "text-gold" : i < 3 ? "text-primary-bright" : "text-muted")}>{i + 1}</span>
              {flagUrl(s.teamRaw) && <img src={flagUrl(s.teamRaw)!} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow" />}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <span className="ml-1.5 text-[11px] text-muted">{s.team}</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-display text-base font-bold tabular-nums text-ink">{s.goals}</span>
                <span className="text-[10px] text-muted">球</span>
              </div>
            </div>
          ))}
        </div>
        <div className="h-32 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topScorers} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Bar dataKey="goals" radius={[0, 4, 4, 0]}>
                {topScorers.map((d, i) => (<Cell key={d.playerId} fill={scorerColors[i]} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 数据说明 */}
      <div className="text-[11px] text-muted text-center">
        数据来源：football-data.org API · 射手榜覆盖 Top 30 球员 · 助攻/位置/点球因数据不完整未展示
      </div>
    </section>
  );
}
