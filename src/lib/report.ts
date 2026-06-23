import type { ApiTeam, MatchRaw } from "../types/worldcup";
import { groupLetter } from "./transform";
import { teamZh } from "./teams";

// 传统强队（用于"爆冷"判定）
const POWERS = new Set([
  "Brazil",
  "Argentina",
  "France",
  "Germany",
  "Spain",
  "England",
  "Portugal",
  "Netherlands",
  "Italy",
  "Belgium",
]);

export interface ReportItem {
  id: number;
  date: string;
  group: string;
  home: ApiTeam;
  away: ApiTeam;
  homeScore: number;
  awayScore: number;
  tags: string[];
  headline: string;
}

/** 由已完赛比赛生成中文战报（模板化，无需 LLM），按时间倒序 */
export function buildReports(matches: MatchRaw[]): ReportItem[] {
  return matches
    .filter((m) => m.status === "FINISHED" && m.score.fullTime.home != null && m.score.fullTime.away != null)
    .map((m): ReportItem => {
      const hs = m.score.fullTime.home as number;
      const as = m.score.fullTime.away as number;
      const h = teamZh(m.homeTeam.name);
      const a = teamZh(m.awayTeam.name);
      const diff = Math.abs(hs - as);
      const total = hs + as;
      const tags: string[] = [];
      let headline: string;

      if (hs === as) {
        if (total === 0) {
          tags.push("闷平");
          headline = `${h} 与 ${a} 互交白卷，闷平收场`;
        } else {
          tags.push("握手言和");
          headline = `${h} ${hs}-${as} 战平 ${a}，握手言和`;
        }
      } else {
        const winName = hs > as ? m.homeTeam.name : m.awayTeam.name;
        const loseName = hs > as ? m.awayTeam.name : m.homeTeam.name;
        const winZh = teamZh(winName);
        const loseZh = teamZh(loseName);
        const ws = Math.max(hs, as);
        const ls = Math.min(hs, as);

        if (diff >= 4) {
          tags.push("血洗");
          headline = `${winZh} ${ws}-${ls} 血洗 ${loseZh}`;
        } else if (diff >= 3) {
          tags.push("大胜");
          headline = `${winZh} ${ws}-${ls} 大胜 ${loseZh}`;
        } else if (diff === 2) {
          headline = `${winZh} ${ws}-${ls} 击退 ${loseZh}`;
        } else {
          tags.push("一球小胜");
          headline = `${winZh} ${ws}-${ls} 险胜 ${loseZh}`;
        }

        if (POWERS.has(loseName) && !POWERS.has(winName)) {
          tags.unshift("爆冷");
        }
      }

      if (total >= 5) tags.push("进球大战");

      return {
        id: m.id,
        date: m.utcDate,
        group: groupLetter(m.group),
        home: m.homeTeam,
        away: m.awayTeam,
        homeScore: hs,
        awayScore: as,
        tags,
        headline,
      };
    })
    .sort((x, y) => y.date.localeCompare(x.date));
}
