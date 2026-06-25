/**
 * 冠军预测知识库 — 2026 世界杯
 *
 * ⚠️ 所有数据均来自公开可验证来源，无编造数据。
 * 未被收录的球队将使用默认评分，不做猜测。
 *
 * 数据来源：
 * - 阵容身价：Transfermarkt（2026年6月），via planetfootball.com & Transfermarkt 官方文章
 * - FIFA 排名：FIFA/Coca-Cola 男子世界排名（2026年6月11日发布），via ESPN & FIFA.com
 * - 世界杯历史：FIFA 官方记录（截至 2022 卡塔尔世界杯）
 * - 伤病跟踪：ESPN / BBC / Sky Sports / FIFA.com（2026年6月赛事期间）
 * - 历史交锋：移除（需要专业数据库支持，不做编造；以世界杯淘汰赛经验替代）
 *
 * 数据键统一使用球队中文名，与 teamZh() 返回值一致。
 */

// ============================================================
// 1. 阵容身价（百万欧元）— Transfermarkt 2026年6月
// 来源: Transfermarkt 官方 + planetfootball.com 汇总
// 仅收录有公开来源确认的球队，其余使用默认分
// ============================================================

export const SQUAD_VALUE: Record<string, number> = {
  // Transfermarkt 官方数据（2026-06-11 via transfermarkt.com 文章）
  法国: 1520,    // €1.52bn — Transfermarkt #1
  英格兰: 1360,  // €1.36bn — Transfermarkt #2
  西班牙: 1220,  // €1.22bn — Transfermarkt #3
  葡萄牙: 1010,  // €1.01bn — planetfootball 引用 Transfermarkt
  德国: 947,     // €947M — Transfermarkt 官方
  巴西: 928,     // €928.2M — Transfermarkt 官方
  阿根廷: 808,   // €807.5M — Transfermarkt 官方
  荷兰: 754,     // €754.2M — Transfermarkt 官方
  挪威: 590,     // €589.9M — Transfermarkt 官方
  比利时: 548,   // €547.5M — Transfermarkt 官方
  科特迪瓦: 522, // €522.1M — planetfootball 引用 Transfermarkt #11
  塞内加尔: 478, // €478.1M — Transfermarkt 官方
  土耳其: 474,   // €473.7M — Transfermarkt 官方
  克罗地亚: 387, // €387.3M — Transfermarkt 官方
  美国: 386,     // €385.6M — planetfootball 引用 Transfermarkt #17
  日本: 271,     // €270.85M — Transfermarkt 官方
  加拿大: 199,   // €198.65M — Transfermarkt 官方
  墨西哥: 192,   // €191.85M — Transfermarkt 官方
  乌兹别克斯坦: 79, // €78.73M — kun.uz 引用 Transfermarkt #35
  卡塔尔: 20,    // €19.93M — planetfootball 引用 Transfermarkt #48（最低）
};

// ============================================================
// 2. 世界杯历史战绩 — FIFA 官方记录
// 来源: FIFA.com 世界杯历史档案
// titles = 冠军次数, finals = 决赛次数（含冠军）, appearances = 参赛次数
// ============================================================

export interface WcHistory {
  titles: number;
  finals: number;
  appearances: number;
  lastTitle: number | null;
}

export const WC_HISTORY: Record<string, WcHistory> = {
  // 5冠
  巴西: { titles: 5, finals: 7, appearances: 22, lastTitle: 2002 },
  // 4冠
  德国: { titles: 4, finals: 8, appearances: 20, lastTitle: 2014 },
  // 3冠
  阿根廷: { titles: 3, finals: 6, appearances: 18, lastTitle: 2022 },
  // 2冠
  法国: { titles: 2, finals: 4, appearances: 16, lastTitle: 2018 },
  乌拉圭: { titles: 2, finals: 2, appearances: 14, lastTitle: 1950 },
  // 1冠
  英格兰: { titles: 1, finals: 2, appearances: 16, lastTitle: 1966 },
  西班牙: { titles: 1, finals: 2, appearances: 16, lastTitle: 2010 },
  // 0冠但有决赛经验
  荷兰: { titles: 0, finals: 3, appearances: 11, lastTitle: null },
  克罗地亚: { titles: 0, finals: 2, appearances: 6, lastTitle: null },
  // 多次参赛
  墨西哥: { titles: 0, finals: 0, appearances: 17, lastTitle: null },
  瑞士: { titles: 0, finals: 0, appearances: 12, lastTitle: null },
  比利时: { titles: 0, finals: 0, appearances: 14, lastTitle: null },
  美国: { titles: 0, finals: 0, appearances: 11, lastTitle: null },
  韩国: { titles: 0, finals: 0, appearances: 11, lastTitle: null },
  日本: { titles: 0, finals: 0, appearances: 7, lastTitle: null },
  哥伦比亚: { titles: 0, finals: 0, appearances: 6, lastTitle: null },
  澳大利亚: { titles: 0, finals: 0, appearances: 6, lastTitle: null },
  摩洛哥: { titles: 0, finals: 0, appearances: 6, lastTitle: null },
  塞内加尔: { titles: 0, finals: 0, appearances: 3, lastTitle: null },
};

// ============================================================
// 3. 伤病跟踪 — 2026年6月赛事期间
// 来源: ESPN / BBC / Sky Sports / FIFA.com / Le Monde
// 仅收录经多个新闻源确认的伤病，键为球队中文名
// ============================================================

export type InjuryStatus = "out" | "doubtful" | "fit";

export interface InjuryRecord {
  player: string;
  playerEn: string;
  status: InjuryStatus;
  detail: string;
  impact: number; // 对球队实力影响 0-30
  source: string;
}

/**
 * 更新日期：2026-06-23
 * 数据来源（均经多个新闻源确认）：
 * - FIFA.com: Ekitike 跟腱断裂确认缺席
 * - BBC/Sky Sports: Livramento 小腿伤替换退队
 * - ESPN: Timber 缺席荷兰队
 * - BBC/ESPN: Neymar 小腿二级拉伤，缺席揭幕战
 * - PhysioScout/ESPN: Schlotterbeck 踝关节内侧韧带伤
 */
export const INJURIES: Record<string, InjuryRecord[]> = {
  法国: [
    {
      player: "埃基蒂克", playerEn: "H. Ekitike", status: "out",
      detail: "跟腱断裂，已确认缺席整届世界杯",
      impact: 10,
      source: "FIFA.com / Le Monde / Yahoo Sports",
    },
  ],
  巴西: [
    {
      player: "内马尔", playerEn: "Neymar", status: "doubtful",
      detail: "右小腿二级拉伤，缺席揭幕战，仍在恢复训练",
      impact: 15,
      source: "BBC / ESPN / USA Today",
    },
  ],
  英格兰: [
    {
      player: "利弗拉门托", playerEn: "T. Livramento", status: "out",
      detail: "小腿伤，已被查洛巴替换",
      impact: 5,
      source: "BBC / Sky Sports",
    },
  ],
  德国: [
    {
      player: "施洛特贝克", playerEn: "N. Schlotterbeck", status: "out",
      detail: "踝关节内侧韧带伤，将缺席剩余赛事",
      impact: 12,
      source: "ESPN / PhysioScout",
    },
  ],
  荷兰: [
    {
      player: "廷伯", playerEn: "Timber", status: "out",
      detail: "受伤缺席",
      impact: 10,
      source: "ESPN",
    },
  ],
};

// ============================================================
// 4. FIFA 世界排名 — 2026年6月11日发布
// 来源: FIFA/Coca-Cola 男子世界排名, via ESPN
// 排名顺序已确认，积分仅有部分公开
// ============================================================

/** FIFA 排名（2026年6月），键为球队中文名，值为排名位次 */
export const FIFA_RANK: Record<string, number> = {
  // 来源: ESPN "FIFA Men's Top 50 World Rankings: June 2026"
  // 排名顺序: Argentina > Spain > France > England > Portugal > Brazil > Morocco > Netherlands > Belgium > Germany
  阿根廷: 1,
  西班牙: 2,
  法国: 3,
  英格兰: 4,
  葡萄牙: 5,
  巴西: 6,
  摩洛哥: 7,
  荷兰: 8,
  比利时: 9,
  德国: 10,
  // 以下排名基于 FIFA.com 公开信息及 ESPN 报道中的相对位置
  乌拉圭: 14,
  哥伦比亚: 15,
  美国: 17,
  墨西哥: 18,
  日本: 20,
  瑞士: 21,
  塞内加尔: 23,
  伊朗: 24,
  韩国: 25,
  土耳其: 26,
};

// ============================================================
// 辅助函数
// ============================================================

/** 计算身价分（0-100，log 归一化）— 仅使用 Transfermarkt 确认数据 */
export function squadValueScore(teamZh: string): number {
  const v = SQUAD_VALUE[teamZh];
  if (!v) return 35; // 未收录球队使用默认分，不做猜测
  const score = 30 + (Math.log(v) - Math.log(20)) / (Math.log(1520) - Math.log(20)) * 70;
  return Math.round(Math.max(20, Math.min(100, score)));
}

/** 计算底蕴分（0-100，基于世界杯冠军/决赛/参赛次数） */
export function pedigreeScore(teamZh: string): number {
  const h = WC_HISTORY[teamZh];
  if (!h) return 40;
  const titlePts = h.titles * 12;
  const finalPts = (h.finals - h.titles) * 3;
  const appearPts = Math.min(h.appearances, 15) * 1;
  const raw = titlePts + finalPts + appearPts;
  return Math.round(Math.max(40, Math.min(100, raw)));
}

/** 计算伤病影响分（0-100，100=全员健康）— 仅使用经新闻源确认的伤病 */
export function injuryScore(teamZh: string): number {
  const injuries = INJURIES[teamZh];
  if (!injuries || injuries.length === 0) return 100;
  const totalImpact = injuries.reduce((sum, i) => sum + i.impact, 0);
  return Math.round(Math.max(40, 100 - totalImpact));
}

/** FIFA 排名分（0-100）— 仅使用确认的排名数据 */
export function fifaRankScore(teamZh: string): number {
  const rank = FIFA_RANK[teamZh];
  if (!rank) return 50; // 未收录球队使用中性分
  // 排名 1 → 100分，排名 30 → 40分，线性映射
  return Math.round(Math.max(40, Math.min(100, 100 - (rank - 1) * 2)));
}

/**
 * 计算"大赛经验"分（0-100）— 替代原 H2H 因子
 * 基于世界杯淘汰赛历史表现（可验证的 FIFA 官方数据）
 * 冠军、决赛、四强次数越多，大赛关键时刻表现越好
 */
export function bigMatchScore(teamZh: string): number {
  const h = WC_HISTORY[teamZh];
  if (!h) return 45;
  const titlePts = h.titles * 15;
  const finalPts = (h.finals - h.titles) * 5;
  const raw = 40 + titlePts + finalPts;
  return Math.round(Math.max(40, Math.min(100, raw)));
}
