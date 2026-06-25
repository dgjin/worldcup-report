import type { GroupTable, MatchRaw } from "../types/worldcup";
import { teamZh } from "./teams";
import {
  squadValueScore,
  pedigreeScore,
  injuryScore,
  fifaRankScore,
  computeH2HScore,
  INJURIES,
  type InjuryRecord,
} from "./prediction-data";

/**
 * 增强型冠军预测模型 — 9 维加权推演
 *
 * 因子权重：
 *   FIFA排名 18%  |  阵容身价 16%  |  实时状态 14%  |  历史底蕴 10%
 *   攻击力  8%   |  防守力  8%   |  伤病影响 10%  |  历史交锋 8%
 *   赛事势头 8%  +  东道主加分
 *
 * 数据来源：
 *   · 实时（API）：小组赛积分/进球/失球/近 3 场势头
 *   · 知识库：FIFA排名、Transfermarkt身价、世界杯历史、伤病跟踪、H2H 交锋库
 */

const HOST = new Set(["美国", "加拿大", "墨西哥"]);

// 争冠级别球队列表（用于 H2H 计算）
const TOP_TEAMS = [
  "阿根廷", "巴西", "法国", "英格兰", "西班牙", "葡萄牙",
  "荷兰", "德国", "比利时", "克罗地亚", "乌拉圭", "摩洛哥",
];

export interface ChampionPick {
  name: string;
  zh: string;
  prob: number;
  // 9 维子分 0-100
  fifa: number;       // FIFA 排名
  squadValue: number; // 阵容身价
  form: number;       // 实时状态
  pedigree: number;   // 历史底蕴
  attack: number;     // 攻击力
  defense: number;    // 防守力
  injury: number;     // 伤病影响
  h2h: number;        // 历史交锋
  momentum: number;   // 赛事势头
  host: boolean;
  injuries: InjuryRecord[];
  reasons: string[];
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));

/** 从最近 3 场比赛计算势头分 */
function computeMomentum(zh: string, matches: MatchRaw[]): number {
  const recent = matches
    .filter((m) => m.status === "FINISHED" && (m.homeTeam?.name || m.awayTeam?.name))
    .filter((m) => {
      const homeZh = teamZh(m.homeTeam?.name);
      const awayZh = teamZh(m.awayTeam?.name);
      return homeZh === zh || awayZh === zh;
    })
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 3);

  if (recent.length === 0) return 50;

  let pts = 0;
  for (const m of recent) {
    const isHome = teamZh(m.homeTeam?.name) === zh;
    const myScore = isHome ? m.score.fullTime.home : m.score.fullTime.away;
    const oppScore = isHome ? m.score.fullTime.away : m.score.fullTime.home;
    if (myScore == null || oppScore == null) continue;
    const gd = myScore - oppScore;
    if (gd > 0) pts += 3 + Math.min(gd, 3) * 0.5;
    else if (gd === 0) pts += 1.5;
    else pts += Math.max(0, 1 + gd * 0.3);
  }
  // 满分约 13.5（3 场全胜且每场净胜 3+）
  return clamp(Math.round((pts / 13.5) * 100));
}

/** 计算赛程难度（对手平均 FIFA 分） */
function reasonsFor(c: {
  fifa: number; squadValue: number; form: number; pedigree: number;
  attack: number; defense: number; injury: number; h2h: number;
  momentum: number; host: boolean; zh: string;
}): string[] {
  const out: string[] = [];
  if (c.fifa >= 85) out.push("FIFA排名顶尖");
  if (c.squadValue >= 85) out.push("阵容身价雄厚");
  if (c.pedigree >= 80) out.push("世界杯底蕴深厚");
  if (c.host) out.push("东道主之利");
  if (c.form >= 75) out.push("小组赛状态火热");
  if (c.momentum >= 75) out.push("近期势头强劲");
  if (c.attack >= 80) out.push("锋线火力凶猛");
  if (c.defense >= 82) out.push("防线固若金汤");
  if (c.h2h >= 60) out.push("交锋心理优势");
  if (c.injury <= 70) out.push("伤病隐患");
  if (c.injury >= 95) out.push("全员健康");
  return out.slice(0, 4);
}

/** 计算夺冠预测，返回按概率降序的前 topN */
export function predictChampions(
  groups: GroupTable[],
  matches: MatchRaw[],
  topN = 8,
): ChampionPick[] {
  const rows = groups.flatMap((g) => g.table);
  if (rows.length === 0) return [];

  const computed = rows.map((r) => {
    const zh = teamZh(r.team.name);
    const played = r.playedGames || 0;
    const ppg = played ? r.points / played : 0;
    const gfpg = played ? r.goalsFor / played : 0;
    const gapg = played ? r.goalsAgainst / played : 1.2;

    // 实时维度
    const form = played ? clamp(50 + (ppg - 1) * 22 + r.goalDifference * 4) : 50;
    const attack = played ? clamp(35 + gfpg * 26) : 50;
    const defense = played ? clamp(92 - gapg * 30) : 60;
    const momentum = computeMomentum(zh, matches);

    // 知识库维度
    const fifa = fifaRankScore(zh);
    const squadValue = squadValueScore(zh);
    const pedigree = pedigreeScore(zh);
    const injury = injuryScore(zh);
    const h2h = computeH2HScore(zh, TOP_TEAMS);
    const host = HOST.has(zh);

    // 加权综合分
    const raw =
      fifa * 0.18 +
      squadValue * 0.16 +
      form * 0.14 +
      pedigree * 0.10 +
      attack * 0.08 +
      defense * 0.08 +
      injury * 0.10 +
      h2h * 0.08 +
      momentum * 0.08 +
      (host ? 4 : 0);

    return { name: r.team.name, zh, raw, fifa, squadValue, form, pedigree, attack, defense, injury, h2h, momentum, host };
  });

  // softmax 归一为概率
  const T = 9;
  const exps = computed.map((c) => Math.exp(c.raw / T));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;

  return computed
    .map((c, i) => ({ ...c, prob: (exps[i] / sum) * 100 }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, topN)
    .map((c) => ({
      name: c.name,
      zh: c.zh,
      prob: c.prob,
      fifa: c.fifa,
      squadValue: c.squadValue,
      form: c.form,
      pedigree: c.pedigree,
      attack: c.attack,
      defense: c.defense,
      injury: c.injury,
      h2h: c.h2h,
      momentum: c.momentum,
      host: c.host,
      injuries: INJURIES[c.zh] ?? [],
      reasons: reasonsFor({
        fifa: c.fifa, squadValue: c.squadValue, form: c.form, pedigree: c.pedigree,
        attack: c.attack, defense: c.defense, injury: c.injury, h2h: c.h2h,
        momentum: c.momentum, host: c.host, zh: c.zh,
      }),
    }));
}
