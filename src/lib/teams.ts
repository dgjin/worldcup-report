import { PLAYER_NAMES } from "./player-names.generated";

// 球队英文名 -> { 中文名, ISO 国旗代码 }。兼容 football-data 可能的别名。
interface TeamMeta {
  zh: string;
  code: string; // flagcdn 代码，支持 gb-eng / gb-sct 等子区域
}

const RAW: Record<string, TeamMeta> = {
  // A
  mexico: { zh: "墨西哥", code: "mx" },
  "south korea": { zh: "韩国", code: "kr" },
  "korea republic": { zh: "韩国", code: "kr" },
  czechia: { zh: "捷克", code: "cz" },
  "czech republic": { zh: "捷克", code: "cz" },
  "south africa": { zh: "南非", code: "za" },
  // B
  canada: { zh: "加拿大", code: "ca" },
  switzerland: { zh: "瑞士", code: "ch" },
  "bosnia and herzegovina": { zh: "波黑", code: "ba" },
  bosniaherzegovina: { zh: "波黑", code: "ba" },
  qatar: { zh: "卡塔尔", code: "qa" },
  // C
  brazil: { zh: "巴西", code: "br" },
  morocco: { zh: "摩洛哥", code: "ma" },
  scotland: { zh: "苏格兰", code: "gb-sct" },
  haiti: { zh: "海地", code: "ht" },
  // D
  "united states": { zh: "美国", code: "us" },
  usa: { zh: "美国", code: "us" },
  australia: { zh: "澳大利亚", code: "au" },
  paraguay: { zh: "巴拉圭", code: "py" },
  turkiye: { zh: "土耳其", code: "tr" },
  turkey: { zh: "土耳其", code: "tr" },
  // E
  germany: { zh: "德国", code: "de" },
  "ivory coast": { zh: "科特迪瓦", code: "ci" },
  "cote divoire": { zh: "科特迪瓦", code: "ci" },
  ecuador: { zh: "厄瓜多尔", code: "ec" },
  curacao: { zh: "库拉索", code: "cw" },
  // F
  netherlands: { zh: "荷兰", code: "nl" },
  japan: { zh: "日本", code: "jp" },
  sweden: { zh: "瑞典", code: "se" },
  tunisia: { zh: "突尼斯", code: "tn" },
  // G
  egypt: { zh: "埃及", code: "eg" },
  iran: { zh: "伊朗", code: "ir" },
  belgium: { zh: "比利时", code: "be" },
  "new zealand": { zh: "新西兰", code: "nz" },
  // H
  spain: { zh: "西班牙", code: "es" },
  uruguay: { zh: "乌拉圭", code: "uy" },
  "cape verde": { zh: "佛得角", code: "cv" },
  "cabo verde": { zh: "佛得角", code: "cv" },
  "cape verde islands": { zh: "佛得角", code: "cv" },
  "saudi arabia": { zh: "沙特阿拉伯", code: "sa" },
  // I
  france: { zh: "法国", code: "fr" },
  norway: { zh: "挪威", code: "no" },
  senegal: { zh: "塞内加尔", code: "sn" },
  iraq: { zh: "伊拉克", code: "iq" },
  // J
  argentina: { zh: "阿根廷", code: "ar" },
  austria: { zh: "奥地利", code: "at" },
  jordan: { zh: "约旦", code: "jo" },
  algeria: { zh: "阿尔及利亚", code: "dz" },
  // K
  colombia: { zh: "哥伦比亚", code: "co" },
  "dr congo": { zh: "刚果（金）", code: "cd" },
  "congo dr": { zh: "刚果（金）", code: "cd" },
  "democratic republic of the congo": { zh: "刚果（金）", code: "cd" },
  portugal: { zh: "葡萄牙", code: "pt" },
  uzbekistan: { zh: "乌兹别克斯坦", code: "uz" },
  // L
  england: { zh: "英格兰", code: "gb-eng" },
  ghana: { zh: "加纳", code: "gh" },
  panama: { zh: "巴拿马", code: "pa" },
  croatia: { zh: "克罗地亚", code: "hr" },
};

// 归一：NFD 分解后，统一小写并去掉非 [a-z0-9 空格]（组合重音符号一并被移除）
function normalize(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// name 在实时数据里可能为 null（淘汰赛未定席位 TBD）
export function teamMeta(name: string | null | undefined): TeamMeta {
  if (!name) return { zh: "待定", code: "" };
  return RAW[normalize(name)] ?? { zh: name, code: "" };
}

export function teamZh(name: string | null | undefined): string {
  return teamMeta(name).zh;
}

export function flagUrl(name: string | null | undefined): string | null {
  const { code } = teamMeta(name);
  return code ? `https://flagcdn.com/${code}.svg` : null;
}

/** 主教练英文名 -> 中文名（按名字关键词匹配） */
const COACH_ZH: Record<string, string> = {
  "Scaloni": "斯卡洛尼",
  "Deschamps": "德希弻",
  "Flick": "弗利克",
  "Spalletti": "斯帕列蒂",
  "De la Fuente": "德拉富恩特",
  "Martinez": "马蒂内斯",
  "Southgate": "南盖特",
  "Tuchel": "图赫尔",
  "Santos": "桑托斯",
  "Bento": "本托",
  "Petkovic": "佩特科维奇",
  "Dalic": "达利奇",
  "Nagelsmann": "纳格尔斯曼",
  "Ancelotti": "安切洛蒂",
  "Enrique": "恩里克",
  "Mancini": "曼奇尼",
  "Wilmots": "威尔莫兹",
  "Moriyasu": "森保康射",
  "Steele": "斯蒂尔",
  "Pearce": "皮尔斯",
  "Renard": "雷纳尔",
  "Hansi": "汉斯弗利克",
  "Conceicao": "康塞萨奥",
  "Berizzo": "贝里佐",
  "Almeyda": "阿尔梅达",
  "Regragui": "雷格拉基",
  "Advocaat": "阿德沃卡特",
  "Broos": "布罗斯",
  "Kounde": "坤德",
};

export function coachZh(name: string | null | undefined): string {
  if (!name) return "";
  for (const [key, zh] of Object.entries(COACH_ZH)) {
    if (name.includes(key)) return zh;
  }
  return name;
}

/** 球员 ID -> 中文名 */
const PLAYER_ZH: Record<number, string> = {
  3218: "梅西",
  3374: "姆巴佩",
  38101: "哈兰德",
  6928: "温达夫",
  8924: "乔纳森·大卫",
  15958: "拉林",
  131040: "巴洛冈",
  130173: "萨伊巴里",
  1556: "维尼修斯",
  171: "哈弗茨",
  6716: "镰田大地",
  145613: "阿亚里",
  28770: "阿劳霍",
  118981: "贾斯特",
  8004: "凯恩",
  212309: "曼扎姆比",
  30842: "马修斯·库尼亚",
  97535: "布罗比",
  7459: "加克波",
  119460: "植田直通",
  44: "C罗",
  3582: "莱万多夫斯基",
  9049: "贝林厄姆",
  11867: "奥斯梅恩",
  6782: "穆科科",
  79892: "古斯塔沃·阿尔法罗",
  35845: "劳塔罗",
  11392: "费尔南德斯",
  9703: "皮奎特",
};

export function playerZh(id: number, fallback: string): string {
  return PLAYER_ZH[id] ?? PLAYER_NAMES[id] ?? fallback;
}

/** 球员真实头像（来自 TheSportsDB） */
const PLAYER_FACES: Record<number, string> = {
  3218: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg",   // 梅西
  3374: "https://r2.thesportsdb.com/images/media/player/thumb/v08cj31778816426.jpg",   // 姆巴佩
  38101: "https://r2.thesportsdb.com/images/media/player/thumb/bb1agj1727415216.jpg",  // 哈兰德
  6928: "https://r2.thesportsdb.com/images/media/player/thumb/rbzyf01779386404.jpg",   // 温达夫
  8924: "https://r2.thesportsdb.com/images/media/player/thumb/hnv78h1742289489.jpg",   // 乔纳森·大卫
  15958: "https://r2.thesportsdb.com/images/media/player/thumb/k17bjv1725044892.jpg",  // 拉林
  131040: "https://r2.thesportsdb.com/images/media/player/thumb/uc8q1x1781348667.jpg", // 巴洛冈
  130173: "https://r2.thesportsdb.com/images/media/player/thumb/tk93qg1702564078.jpg", // 萨伊巴里
  1556: "https://r2.thesportsdb.com/images/media/player/thumb/lxf1he1771264845.jpg",   // 维尼修斯
  171: "https://r2.thesportsdb.com/images/media/player/thumb/5c3h061780160105.jpg",    // 哈弗茨
  6716: "https://r2.thesportsdb.com/images/media/player/thumb/ol23bf1772140877.jpg",   // 镰田大地
  145613: "https://r2.thesportsdb.com/images/media/player/thumb/xg6mwr1778610967.jpg", // 阿亚里
  118981: "https://r2.thesportsdb.com/images/media/player/thumb/ppikbx1778731424.jpg", // 贾斯特
  8004: "https://r2.thesportsdb.com/images/media/player/thumb/0w9up71770542636.jpg",   // 凯恩
  30842: "https://r2.thesportsdb.com/images/media/player/thumb/1nt1i61770993321.jpg",  // 马修斯·库尼亚
  97535: "https://r2.thesportsdb.com/images/media/player/thumb/7odze71772029250.jpg",  // 布罗比
  7459: "https://r2.thesportsdb.com/images/media/player/thumb/m9g2ki1669145821.jpg",   // 加克波
  119460: "https://r2.thesportsdb.com/images/media/player/thumb/l14g0v1668623556.jpg", // 植田直通
};

/** 是否为本应用已收录的"知名/核心"球员（有中文名或真实头像） */
export function isStarPlayer(id: number): boolean {
  return id in PLAYER_ZH || id in PLAYER_FACES;
}

/** 球员头像 URL：优先使用真实照片，否则生成文字头像 */
export function playerFaceUrl(id: number, name: string, teamName: string | null): string {
  if (PLAYER_FACES[id]) return PLAYER_FACES[id];
  // 回退：ui-avatars 生成文字头像
  const zhName = playerZh(id, name);
  const initial = /[\u4e00-\u9fff]/.test(zhName) ? zhName[0] : name.slice(0, 2).toUpperCase();
  const colors = ["1a73e8", "e53935", "43a047", "fb8c00", "8e24aa", "00897b", "3949ab", "d81b60", "6d4c41", "546e7a"];
  const hash = (teamName || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${bg}&color=fff&size=128&font-size=0.5&bold=true`;
}
