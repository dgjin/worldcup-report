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
import { goalsByGroup, goalsByMatchday } from "../lib/transform";
import { teamZh, playerZh, flagUrl } from "../lib/teams";
import { Card, SectionHeading } from "../components/ui";

const C = {
  primary: "#e63946",
  gold: "#ffd60a",
  pitch: "#2dd36f",
  muted: "#8a97b8",
  line: "#243154",
  surface: "#121a2e",
};

const tooltipStyle = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  color: "#eaf0ff",
  fontSize: 12,
};

function StatTile({ label, value, unit, tone }: { label: string; value: string | number; unit?: string; tone: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold tabular-nums" style={{ color: tone }}>
          {value}
        </span>
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
      </div>
    </Card>
  );
}

export default function Charts({
  groups,
  matches,
  scorers,
}: {
  groups: GroupTable[];
  matches: SplitMatches;
  scorers: ScorerRaw[];
}) {
  const byGroup = goalsByGroup(groups);
  const byMatchday = goalsByMatchday(matches.finished);
  const topScorers = scorers.slice(0, 10).map((s) => ({
    name: playerZh(s.player.id, s.player.name),
    enName: s.player.name,
    team: teamZh(s.team.name),
    teamRaw: s.team.name,
    goals: s.goals,
    penalties: s.penalties,
    playerId: s.player.id,
  }));

  const totalGoals = matches.finished.reduce(
    (sum, m) => sum + (m.score.fullTime.home ?? 0) + (m.score.fullTime.away ?? 0),
    0,
  );
  const played = matches.finished.length;
  const avg = played ? (totalGoals / played).toFixed(2) : "0";
  const biggest = matches.finished.reduce(
    (best, m) => {
      const diff = Math.abs((m.score.fullTime.home ?? 0) - (m.score.fullTime.away ?? 0));
      return diff > best.diff
        ? { diff, text: `${(m.score.fullTime.home ?? 0)}-${m.score.fullTime.away ?? 0}`, who: teamZh((m.score.fullTime.home ?? 0) >= (m.score.fullTime.away ?? 0) ? m.homeTeam.name : m.awayTeam.name) }
        : best;
    },
    { diff: 0, text: "—", who: "" },
  );

  return (
    <section className="space-y-6">
      <SectionHeading kicker="数据统计" title="数据图表" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="总进球" value={totalGoals} unit="球" tone={C.gold} />
        <StatTile label="已赛场次" value={played} unit="场" tone="#eaf0ff" />
        <StatTile label="场均进球" value={avg} unit="球/场" tone={C.pitch} />
        <StatTile label="最大分差" value={biggest.text} unit={biggest.who} tone={C.primary} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 font-display text-base font-semibold text-ink">各小组总进球</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byGroup} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="group" stroke={C.muted} fontSize={12} tickLine={false} />
              <YAxis stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="goals" name="进球" radius={[4, 4, 0, 0]}>
                {byGroup.map((d) => (
                  <Cell key={d.group} fill={d.goals >= 12 ? C.gold : C.primary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-display text-base font-semibold text-ink">各轮进球数</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byMatchday} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="matchday" stroke={C.muted} fontSize={12} tickLine={false} />
              <YAxis stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="goals" name="进球" fill={C.pitch} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-4 font-display text-base font-semibold text-ink">射手榜 Top 10</h3>
        {/* 横向条形图 */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topScorers} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
            <XAxis type="number" stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={11} width={80} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(value, _name, entry) => {
                const p = (entry as { payload: (typeof topScorers)[0] }).payload;
                return [`${value} 球${p.penalties ? `（含点球${p.penalties}）` : ""}`, p.team];
              }}
            />
            <Bar dataKey="goals" name="进球" radius={[0, 4, 4, 0]}>
              {topScorers.map((d, i) => (
                <Cell key={d.playerId} fill={i === 0 ? C.gold : i < 3 ? C.primary : "#3a4a7a"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* 列表：国旗 + 中文名 + 球队 + 进球 */}
        <div className="mt-4 divide-y divide-line/40">
          {topScorers.map((s, i) => {
            const flag = flagUrl(s.teamRaw);
            return (
              <div key={s.playerId} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-center font-display text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                {flag && <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow" />}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  {s.name !== s.enName && (
                    <span className="ml-1.5 text-[11px] text-muted">{s.enName}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted">{s.team}</span>
                <div className="flex w-12 items-baseline justify-end gap-0.5">
                  <span
                    className="font-display text-lg font-bold tabular-nums"
                    style={{ color: i === 0 ? C.gold : i < 3 ? C.primary : "#eaf0ff" }}
                  >
                    {s.goals}
                  </span>
                  <span className="text-[10px] text-muted">球</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
