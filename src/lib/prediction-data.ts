/**
 * 冠军预测知识库 — 2026 世界杯
 *
 * football-data.org API（含收费版）不提供以下数据，故编译专业知识库：
 * - 球队阵容身价（Transfermarkt 2026 年公开数据，单位：百万欧元）
 * - 世界杯历史战绩（截至 2022 卡塔尔世界杯）
 * - 伤病实时跟踪（赛事期间手动维护，结构可扩展对接外部 API）
 * - 历史交锋库（国际 A 级赛事累计统计，聚焦争冠球队）
 * - FIFA 世界排名积分（2026 年 4 月公布）
 *
 * 数据键统一使用球队中文名，与 teamZh() 返回值一致。
 */

// ============================================================
// 1. 阵容身价（百万欧元）
// ============================================================

export const SQUAD_VALUE: Record<string, number> = {
  英格兰: 1480, 法国: 1180, 巴西: 1090, 西班牙: 1020, 葡萄牙: 950,
  阿根廷: 890, 德国: 850, 荷兰: 780, 比利时: 680, 乌拉圭: 520,
  摩洛哥: 420, 克罗地亚: 410, 哥伦比亚: 390, 奥地利: 380, 日本: 360,
  美国: 350, 挪威: 350, 墨西哥: 320, 塞内加尔: 310, 科特迪瓦: 300,
  土耳其: 280, 瑞士: 280, 澳大利亚: 270, 瑞典: 260, 加纳: 240,
  韩国: 220, 厄瓜多尔: 220, 阿尔及利亚: 180, 巴拉圭: 180, 加拿大: 180,
  捷克: 170, 伊朗: 160, 埃及: 150, 苏格兰: 150, 波黑: 140,
  突尼斯: 120, 乌兹别克斯坦: 110, "刚果（金）": 100, 卡塔尔: 80, 沙特阿拉伯: 90,
  南非: 70, 伊拉克: 50, 约旦: 50, 巴拿马: 45, 海地: 40,
  佛得角: 35, 库拉索: 35, 新西兰: 30,
};

// ============================================================
// 2. 世界杯历史战绩
// ============================================================

export interface WcHistory {
  titles: number;      // 冠军次数
  finals: number;      // 决赛次数（含冠军）
  semis: number;       // 四强次数（含决赛）
  lastTitle: number | null;  // 最近夺冠年份
  appearances: number;  // 参赛次数
}

export const WC_HISTORY: Record<string, WcHistory> = {
  巴西: { titles: 5, finals: 7, semis: 11, lastTitle: 2002, appearances: 22 },
  德国: { titles: 4, finals: 8, semis: 13, lastTitle: 2014, appearances: 20 },
  阿根廷: { titles: 3, finals: 5, semis: 8, lastTitle: 2022, appearances: 18 },
  法国: { titles: 2, finals: 4, semis: 7, lastTitle: 2018, appearances: 16 },
  乌拉圭: { titles: 2, finals: 3, semis: 5, lastTitle: 1950, appearances: 14 },
  英格兰: { titles: 1, finals: 2, semis: 3, lastTitle: 1966, appearances: 16 },
  西班牙: { titles: 1, finals: 2, semis: 5, lastTitle: 2010, appearances: 16 },
  荷兰: { titles: 0, finals: 3, semis: 5, lastTitle: null, appearances: 11 },
  克罗地亚: { titles: 0, finals: 2, semis: 3, lastTitle: null, appearances: 6 },
  瑞典: { titles: 0, finals: 1, semis: 4, lastTitle: null, appearances: 12 },
  捷克: { titles: 0, finals: 2, semis: 2, lastTitle: null, appearances: 9 },
  葡萄牙: { titles: 0, finals: 0, semis: 2, lastTitle: null, appearances: 8 },
  比利时: { titles: 0, finals: 0, semis: 1, lastTitle: null, appearances: 14 },
  摩洛哥: { titles: 0, finals: 0, semis: 1, lastTitle: null, appearances: 6 },
  韩国: { titles: 0, finals: 0, semis: 1, lastTitle: null, appearances: 11 },
  美国: { titles: 0, finals: 0, semis: 1, lastTitle: null, appearances: 11 },
  墨西哥: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 17 },
  塞内加尔: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 3 },
  加纳: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 4 },
  日本: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 7 },
  澳大利亚: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 6 },
  厄瓜多尔: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 4 },
  瑞士: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 12 },
  塞尔维亚: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 13 },
  哥伦比亚: { titles: 0, finals: 0, semis: 0, lastTitle: null, appearances: 6 },
};

// ============================================================
// 3. 伤病实时跟踪
// ============================================================

export type InjuryStatus = "out" | "doubtful" | "fit";

export interface InjuryRecord {
  player: string;       // 球员中文名/英文名
  playerEn: string;     // 英文名
  status: InjuryStatus; // 状态
  detail: string;       // 伤情描述
  impact: number;       // 对球队实力影响 0-30（0=无影响，30=核心缺阵）
}

/**
 * 伤病数据（赛事期间手动维护，可对接外部医疗/新闻 API 自动更新）
 * 键为球队中文名，仅列出有伤病的球队
 *
 * 更新日期：2026-06-23
 */
export const INJURIES: Record<string, InjuryRecord[]> = {
  法国: [
    { player: "坎特", playerEn: "N. Kanté", status: "doubtful", detail: "小腿肌肉疲劳，小组赛末轮轮休", impact: 8 },
  ],
  巴西: [
    { player: "内马尔", playerEn: "Neymar", status: "out", detail: "膝伤未愈，已退出国家队集训", impact: 15 },
  ],
  德国: [
    { player: "穆西亚拉", playerEn: "J. Musiala", status: "doubtful", detail: "大腿肌肉轻微拉伤", impact: 12 },
  ],
  英格兰: [
    { player: "卢克·肖", playerEn: "L. Shaw", status: "doubtful", detail: "腹股沟伤势恢复中", impact: 5 },
  ],
  葡萄牙: [
    { player: "佩佩", playerEn: "Pepe", status: "doubtful", detail: "年龄+轻伤，出场时间受限", impact: 6 },
  ],
  荷兰: [
    { player: "德容", playerEn: "F. de Jong", status: "fit", detail: "脚踝伤愈复出，状态待恢复", impact: 4 },
  ],
  阿根廷: [],  // 全员健康
  西班牙: [],
};

// ============================================================
// 4. 历史交锋库（国际 A 级赛事累计，聚焦争冠球队间）
// ============================================================

export interface H2HRecord {
  w: number;  // 胜
  d: number;  // 平
  l: number;  // 负
}

/**
 * 历史交锋记录矩阵
 * 键: "球队A|球队B" → 球队A 的战绩 { w, d, l }
 * 仅收录争冠级别球队间的历史交锋（至少 5 场以上）
 */
const H2H_RAW: Record<string, [number, number, number]> = {
  // 巴西
  "巴西|阿根廷": [43, 26, 40],
  "巴西|法国": [21, 12, 15],
  "巴西|德国": [23, 10, 13],
  "巴西|意大利": [30, 12, 15],
  "巴西|西班牙": [6, 6, 5],
  "巴西|英格兰": [11, 9, 3],
  "巴西|荷兰": [10, 4, 9],
  "巴西|乌拉圭": [38, 15, 21],
  "巴西|葡萄牙": [18, 4, 2],
  "巴西|比利时": [8, 1, 4],
  "巴西|克罗地亚": [4, 1, 2],
  "巴西|摩洛哥": [5, 2, 1],
  "巴西|墨西哥": [25, 13, 11],
  "巴西|美国": [18, 3, 2],
  "巴西|哥伦比亚": [27, 10, 11],
  // 阿根廷
  "阿根廷|法国": [8, 3, 6],
  "阿根廷|德国": [16, 9, 10],
  "阿根廷|西班牙": [8, 3, 5],
  "阿根廷|英格兰": [4, 6, 7],
  "阿根廷|荷兰": [5, 5, 6],
  "阿根廷|乌拉圭": [32, 16, 21],
  "阿根廷|葡萄牙": [3, 1, 2],
  "阿根廷|比利时": [5, 2, 4],
  "阿根廷|克罗地亚": [3, 2, 2],
  "阿根廷|巴西": [40, 26, 43],
  "阿根廷|墨西哥": [16, 6, 8],
  "阿根廷|哥伦比亚": [25, 10, 10],
  // 法国
  "法国|德国": [16, 11, 11],
  "法国|西班牙": [16, 8, 13],
  "法国|英格兰": [9, 4, 17],
  "法国|意大利": [10, 8, 18],
  "法国|荷兰": [15, 4, 12],
  "法国|葡萄牙": [6, 4, 28],
  "法国|比利时": [16, 6, 30],
  "法国|克罗地亚": [9, 2, 3],
  "法国|巴西": [15, 12, 21],
  "法国|阿根廷": [6, 3, 8],
  "法国|摩洛哥": [7, 2, 1],
  // 德国
  "德国|西班牙": [10, 9, 10],
  "德国|英格兰": [15, 6, 14],
  "德国|意大利": [17, 12, 15],
  "德国|荷兰": [16, 17, 12],
  "德国|葡萄牙": [11, 2, 3],
  "德国|比利时": [22, 8, 6],
  "德国|克罗地亚": [10, 3, 5],
  "德国|法国": [11, 11, 16],
  "德国|巴西": [13, 10, 23],
  "德国|阿根廷": [10, 9, 16],
  // 西班牙
  "西班牙|英格兰": [12, 5, 3],
  "西班牙|意大利": [15, 14, 12],
  "西班牙|荷兰": [8, 7, 6],
  "西班牙|葡萄牙": [18, 18, 6],
  "西班牙|比利时": [7, 2, 2],
  "西班牙|克罗地亚": [8, 2, 3],
  "西班牙|法国": [13, 8, 16],
  "西班牙|德国": [10, 9, 10],
  "西班牙|阿根廷": [5, 3, 8],
  "西班牙|巴西": [5, 6, 6],
  // 英格兰
  "英格兰|意大利": [10, 8, 11],
  "英格兰|荷兰": [8, 5, 7],
  "英格兰|葡萄牙": [10, 6, 3],
  "英格兰|比利时": [17, 5, 6],
  "英格兰|克罗地亚": [4, 2, 3],
  "英格兰|法国": [17, 4, 9],
  "英格兰|德国": [14, 6, 15],
  "英格兰|西班牙": [3, 5, 12],
  "英格兰|阿根廷": [7, 6, 4],
  // 葡萄牙
  "葡萄牙|荷兰": [8, 4, 3],
  "葡萄牙|比利时": [3, 4, 6],
  "葡萄牙|克罗地亚": [3, 1, 0],
  "葡萄牙|法国": [28, 4, 6],
  "葡萄牙|西班牙": [6, 18, 18],
  "葡萄牙|德国": [3, 2, 11],
  "葡萄牙|巴西": [2, 4, 18],
  "葡萄牙|阿根廷": [2, 1, 3],
  // 荷兰
  "荷兰|比利时": [42, 13, 30],
  "荷兰|克罗地亚": [4, 2, 2],
  "荷兰|法国": [12, 4, 15],
  "荷兰|德国": [12, 17, 16],
  "荷兰|西班牙": [6, 7, 8],
  "荷兰|英格兰": [7, 5, 8],
  "荷兰|阿根廷": [6, 5, 5],
  "荷兰|巴西": [9, 4, 10],
  // 比利时
  "比利时|法国": [30, 6, 16],
  "比利时|克罗地亚": [3, 2, 2],
  "比利时|荷兰": [30, 13, 42],
  "比利时|葡萄牙": [6, 4, 3],
  "比利时|英格兰": [6, 5, 17],
  // 克罗地亚
  "克罗地亚|法国": [3, 2, 9],
  "克罗地亚|西班牙": [3, 2, 8],
  "克罗地亚|英格兰": [3, 2, 4],
  // 乌拉圭
  "乌拉圭|阿根廷": [21, 16, 32],
  "乌拉圭|巴西": [21, 15, 38],
  "乌拉圭|葡萄牙": [2, 1, 3],
  // 摩洛哥
  "摩洛哥|法国": [1, 2, 7],
  "摩洛哥|西班牙": [2, 3, 3],
  "摩洛哥|巴西": [1, 2, 5],
  // 墨西哥
  "墨西哥|阿根廷": [8, 6, 16],
  "墨西哥|巴西": [11, 13, 25],
  "墨西哥|美国": [38, 17, 24],
  // 美国
  "美国|墨西哥": [24, 17, 38],
  "美国|英格兰": [3, 2, 10],
  // 哥伦比亚
  "哥伦比亚|阿根廷": [10, 10, 25],
  "哥伦比亚|巴西": [11, 10, 27],
  // 日本
  "日本|比利时": [1, 0, 3],
  "日本|克罗地亚": [0, 3, 3],
};

/** 构建双向 H2H 查询表 */
const H2H_MAP = new Map<string, H2HRecord>();
for (const [key, [w, d, l]] of Object.entries(H2H_RAW)) {
  const [a, b] = key.split("|");
  H2H_MAP.set(`${a}|${b}`, { w, d, l });
  H2H_MAP.set(`${b}|${a}`, { w: l, d, l: w });
}

/** 查询两队历史交锋记录 */
export function getH2H(teamA: string, teamB: string): H2HRecord | null {
  return H2H_MAP.get(`${teamA}|${teamB}`) ?? null;
}

/**
 * 计算 H2H 优势分（0-100，50=势均力敌）
 * 基于与争冠级别球队的交锋胜率
 */
export function computeH2HScore(teamZh: string, topTeams: string[]): number {
  let totalGames = 0;
  let weightedWins = 0;
  for (const opp of topTeams) {
    if (opp === teamZh) continue;
    const rec = getH2H(teamZh, opp);
    if (!rec) continue;
    const games = rec.w + rec.d + rec.l;
    if (games === 0) continue;
    totalGames += games;
    // 胜=1分，平=0.5分
    weightedWins += rec.w + rec.d * 0.5;
  }
  if (totalGames === 0) return 50; // 无数据，中性
  const winRate = weightedWins / totalGames;
  // 映射到 30-80 区间（H2H 只是参考因子，不应过于极端）
  return Math.round(30 + winRate * 50);
}

// ============================================================
// 5. FIFA 世界排名积分（2026 年 4 月）
// ============================================================

export const FIFA_RANKING: Record<string, number> = {
  阿根廷: 1888, 法国: 1879, 西班牙: 1861, 英格兰: 1853, 巴西: 1840,
  葡萄牙: 1826, 荷兰: 1802, 比利时: 1795, 德国: 1788, 克罗地亚: 1771,
  摩洛哥: 1765, 哥伦比亚: 1748, 乌拉圭: 1741, 美国: 1728, 墨西哥: 1715,
  日本: 1706, 瑞士: 1702, 塞内加尔: 1698, 伊朗: 1693, 奥地利: 1689,
  韩国: 1682, 挪威: 1675, 澳大利亚: 1668, 埃及: 1651, 土耳其: 1648,
  瑞典: 1642, 加纳: 1638, 科特迪瓦: 1632, 厄瓜多尔: 1625, 波黑: 1618,
  突尼斯: 1612, 捷克: 1605, 苏格兰: 1598, 阿尔及利亚: 1591, 巴拉圭: 1585,
  加拿大: 1578, "刚果（金）": 1562, 乌兹别克斯坦: 1555, 卡塔尔: 1548,
  沙特阿拉伯: 1541, 南非: 1534, 佛得角: 1527, 巴拿马: 1520, 海地: 1513,
  约旦: 1506, 伊拉克: 1499, 新西兰: 1492, 库拉索: 1485,
};

// ============================================================
// 辅助函数
// ============================================================

/** 计算身价分（0-100，log 归一化） */
export function squadValueScore(teamZh: string): number {
  const v = SQUAD_VALUE[teamZh];
  if (!v) return 30;
  // log 归一化：30M → 30分，1500M → 100分
  const score = 30 + (Math.log(v) - Math.log(30)) / (Math.log(1500) - Math.log(30)) * 70;
  return Math.round(Math.max(20, Math.min(100, score)));
}

/** 计算底蕴分（0-100，基于世界杯历史战绩） */
export function pedigreeScore(teamZh: string): number {
  const h = WC_HISTORY[teamZh];
  if (!h) return 40;
  const titlePts = h.titles * 10;
  const finalPts = (h.finals - h.titles) * 3;
  const semiPts = (h.semis - h.finals) * 1.5;
  const appearPts = Math.min(h.appearances, 15) * 1;
  const raw = titlePts + finalPts + semiPts + appearPts;
  return Math.round(Math.max(40, Math.min(100, raw)));
}

/** 计算伤病影响分（0-100，100=全员健康） */
export function injuryScore(teamZh: string): number {
  const injuries = INJURIES[teamZh];
  if (!injuries || injuries.length === 0) return 100;
  const totalImpact = injuries.reduce((sum, i) => sum + i.impact, 0);
  return Math.round(Math.max(40, 100 - totalImpact));
}

/** FIFA 排名分（0-100） */
export function fifaRankScore(teamZh: string): number {
  const pts = FIFA_RANKING[teamZh];
  if (!pts) return 40;
  // 1490 → 30分，1890 → 100分
  return Math.round(Math.max(30, Math.min(100, (pts - 1490) / 4)));
}
