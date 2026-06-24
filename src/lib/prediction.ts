import type { GroupTable } from "../types/worldcup";
import { teamZh } from "./teams";

/**
 * 冠军预测：多维度加权模型（仅供参考）
 *
 * - 底蕴分 BASE（API 拿不到的维度，精选知识库）：阵容身价/实力(5)、历史大赛底蕴与经验(13)、
 *   传统强弱与历史交锋参考(2)、核心球员成色(4) 综合折算。
 * - 东道主 HOST：东道主效应(6)。
 * - 实时维度（来自小组赛真实数据）：近期状态/小组形势(1,3)、攻击力(12)、防守稳固度(11)、净胜球。
 * - 其余维度（伤病、气候适应、赛程体能、战术风格、舆论氛围等）数据有限，已并入底蕴评估。
 */

const HOST = new Set(["美国", "加拿大", "墨西哥"]);

// 球队底蕴分（0-100）：综合阵容实力/身价、历史底蕴、大赛经验。键为中文名（兼容实时/快照英文名）。
const BASE: Record<string, number> = {
  阿根廷: 95, 西班牙: 93, 法国: 93, 英格兰: 91, 巴西: 91, 葡萄牙: 88, 荷兰: 86, 德国: 85,
  比利时: 80, 克罗地亚: 78, 摩洛哥: 77, 哥伦比亚: 76, 乌拉圭: 76, 日本: 74, 美国: 73, 墨西哥: 72,
  瑞士: 72, 塞内加尔: 72, 挪威: 71, 厄瓜多尔: 69, 奥地利: 68, 埃及: 68, 韩国: 68, 科特迪瓦: 66,
  瑞典: 66, 土耳其: 66, 澳大利亚: 65, 阿尔及利亚: 64, 加拿大: 64, 捷克: 63, 苏格兰: 63, 伊朗: 63,
  加纳: 62, 波黑: 60, 巴拉圭: 60, "刚果（金）": 59, 突尼斯: 58, 卡塔尔: 57, 沙特阿拉伯: 56,
  南非: 56, 佛得角: 54, 乌兹别克斯坦: 54, 巴拿马: 53, 约旦: 52, 伊拉克: 52, 新西兰: 50, 海地: 47, 库拉索: 47,
};

export interface ChampionPick {
  /** 原始英文名（用于 Flag / teamZh） */
  name: string;
  zh: string;
  /** 夺冠概率 % */
  prob: number;
  /** 各维度子分 0-100，用于透明展示 */
  pedigree: number;
  form: number;
  attack: number;
  defense: number;
  host: boolean;
  reasons: string[];
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));

function reasonsFor(c: { base: number; host: boolean; form: number; attack: number; defense: number }): string[] {
  const out: string[] = [];
  if (c.base >= 88) out.push("夺冠级阵容底蕴");
  else if (c.base >= 78) out.push("传统强队实力");
  if (c.host) out.push("东道主之利");
  if (c.form >= 75) out.push("小组赛状态火热");
  else if (c.form <= 40) out.push("近期状态低迷");
  if (c.attack >= 80) out.push("锋线火力强劲");
  if (c.defense >= 82) out.push("防线稳固");
  else if (c.defense <= 45) out.push("防守存隐患");
  return out.slice(0, 3);
}

/** 计算夺冠预测，返回按概率降序的前 topN */
export function predictChampions(groups: GroupTable[], topN = 8): ChampionPick[] {
  const rows = groups.flatMap((g) => g.table);
  if (rows.length === 0) return [];

  const computed = rows.map((r) => {
    const zh = teamZh(r.team.name);
    const base = BASE[zh] ?? 48;
    const played = r.playedGames || 0;
    const ppg = played ? r.points / played : 0;
    const gfpg = played ? r.goalsFor / played : 0;
    const gapg = played ? r.goalsAgainst / played : 1.2;
    const host = HOST.has(zh);
    const form = played ? clamp(50 + (ppg - 1) * 22 + r.goalDifference * 4) : 50;
    const attack = played ? clamp(35 + gfpg * 26) : 50;
    const defense = played ? clamp(92 - gapg * 30) : 60;
    const raw = base * 0.62 + (host ? 5 : 0) + (form - 50) * 0.28 + (attack - 50) * 0.12 + (defense - 50) * 0.1;
    return { name: r.team.name, zh, base, raw, form, attack, defense, host };
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
      pedigree: Math.round(c.base),
      form: Math.round(c.form),
      attack: Math.round(c.attack),
      defense: Math.round(c.defense),
      host: c.host,
      reasons: reasonsFor({ base: c.base, host: c.host, form: c.form, attack: c.attack, defense: c.defense }),
    }));
}
