// 由真实赛果构建 data/snapshot.json（football-data.org v4 同构）。
// 积分榜由比分推导，保证内部一致。赛果截至 2026-06-23，交叉验证自 NBC / ESPN。
// 用法：node data/build-snapshot.mjs   （或 npm run snapshot）
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 球队注册表：英文名 -> { id, tla }（中文名与国旗在前端按英文名映射）
const T = {
  Mexico: { id: 1, tla: "MEX" }, "South Korea": { id: 2, tla: "KOR" }, Czechia: { id: 3, tla: "CZE" }, "South Africa": { id: 4, tla: "RSA" },
  Canada: { id: 5, tla: "CAN" }, Switzerland: { id: 6, tla: "SUI" }, "Bosnia and Herzegovina": { id: 7, tla: "BIH" }, Qatar: { id: 8, tla: "QAT" },
  Brazil: { id: 9, tla: "BRA" }, Morocco: { id: 10, tla: "MAR" }, Scotland: { id: 11, tla: "SCO" }, Haiti: { id: 12, tla: "HAI" },
  "United States": { id: 13, tla: "USA" }, Australia: { id: 14, tla: "AUS" }, Paraguay: { id: 15, tla: "PAR" }, "Türkiye": { id: 16, tla: "TUR" },
  Germany: { id: 17, tla: "GER" }, "Ivory Coast": { id: 18, tla: "CIV" }, Ecuador: { id: 19, tla: "ECU" }, "Curaçao": { id: 20, tla: "CUW" },
  Netherlands: { id: 21, tla: "NED" }, Japan: { id: 22, tla: "JPN" }, Sweden: { id: 23, tla: "SWE" }, Tunisia: { id: 24, tla: "TUN" },
  Egypt: { id: 25, tla: "EGY" }, Iran: { id: 26, tla: "IRN" }, Belgium: { id: 27, tla: "BEL" }, "New Zealand": { id: 28, tla: "NZL" },
  Spain: { id: 29, tla: "ESP" }, Uruguay: { id: 30, tla: "URU" }, "Cape Verde": { id: 31, tla: "CPV" }, "Saudi Arabia": { id: 32, tla: "KSA" },
  France: { id: 33, tla: "FRA" }, Norway: { id: 34, tla: "NOR" }, Senegal: { id: 35, tla: "SEN" }, Iraq: { id: 36, tla: "IRQ" },
  Argentina: { id: 37, tla: "ARG" }, Austria: { id: 38, tla: "AUT" }, Jordan: { id: 39, tla: "JOR" }, Algeria: { id: 40, tla: "ALG" },
  Colombia: { id: 41, tla: "COL" }, "DR Congo": { id: 42, tla: "COD" }, Portugal: { id: 43, tla: "POR" }, Uzbekistan: { id: 44, tla: "UZB" },
  England: { id: 45, tla: "ENG" }, Ghana: { id: 46, tla: "GHA" }, Panama: { id: 47, tla: "PAN" }, Croatia: { id: 48, tla: "CRO" },
};

const team = (name) => ({ id: T[name].id, name, tla: T[name].tla });

// 已完赛：[组, 轮次, 主, 主进, 客, 客进, 日期]
const finished = [
  ["A", 1, "Mexico", 2, "South Africa", 0, "2026-06-13"], ["A", 1, "South Korea", 2, "Czechia", 1, "2026-06-13"],
  ["A", 2, "Czechia", 1, "South Africa", 1, "2026-06-19"], ["A", 2, "Mexico", 1, "South Korea", 0, "2026-06-19"],
  ["B", 1, "Switzerland", 4, "Bosnia and Herzegovina", 1, "2026-06-13"], ["B", 1, "Canada", 6, "Qatar", 0, "2026-06-13"],
  ["B", 2, "Canada", 1, "Bosnia and Herzegovina", 1, "2026-06-19"], ["B", 2, "Qatar", 1, "Switzerland", 1, "2026-06-19"],
  ["C", 1, "Brazil", 1, "Morocco", 1, "2026-06-14"], ["C", 1, "Haiti", 0, "Scotland", 1, "2026-06-14"],
  ["C", 2, "Scotland", 0, "Morocco", 1, "2026-06-20"], ["C", 2, "Brazil", 3, "Haiti", 0, "2026-06-20"],
  ["D", 1, "United States", 4, "Paraguay", 1, "2026-06-12"], ["D", 1, "Australia", 2, "Türkiye", 0, "2026-06-14"],
  ["D", 2, "United States", 2, "Australia", 0, "2026-06-18"], ["D", 2, "Türkiye", 0, "Paraguay", 1, "2026-06-18"],
  ["E", 1, "Germany", 7, "Curaçao", 1, "2026-06-15"], ["E", 1, "Ivory Coast", 1, "Ecuador", 0, "2026-06-15"],
  ["E", 2, "Germany", 2, "Ivory Coast", 1, "2026-06-21"], ["E", 2, "Ecuador", 0, "Curaçao", 0, "2026-06-21"],
  ["F", 1, "Netherlands", 2, "Japan", 2, "2026-06-15"], ["F", 1, "Sweden", 5, "Tunisia", 1, "2026-06-15"],
  ["F", 2, "Netherlands", 5, "Sweden", 1, "2026-06-21"], ["F", 2, "Japan", 4, "Tunisia", 0, "2026-06-21"],
  ["G", 1, "Belgium", 1, "Egypt", 1, "2026-06-16"], ["G", 1, "Iran", 2, "New Zealand", 2, "2026-06-16"],
  ["G", 2, "Belgium", 0, "Iran", 0, "2026-06-22"], ["G", 2, "New Zealand", 1, "Egypt", 3, "2026-06-22"],
  ["H", 1, "Spain", 0, "Cape Verde", 0, "2026-06-16"], ["H", 1, "Saudi Arabia", 1, "Uruguay", 1, "2026-06-16"],
  ["H", 2, "Spain", 4, "Saudi Arabia", 0, "2026-06-22"], ["H", 2, "Uruguay", 2, "Cape Verde", 2, "2026-06-22"],
  ["I", 1, "France", 3, "Senegal", 1, "2026-06-17"], ["I", 1, "Iraq", 1, "Norway", 4, "2026-06-17"],
  ["I", 2, "France", 3, "Iraq", 0, "2026-06-22"], ["I", 2, "Norway", 3, "Senegal", 2, "2026-06-22"],
  ["J", 1, "Argentina", 3, "Algeria", 0, "2026-06-17"], ["J", 1, "Austria", 3, "Jordan", 1, "2026-06-17"],
  ["J", 2, "Argentina", 2, "Austria", 0, "2026-06-22"],
  ["K", 1, "Colombia", 3, "Uzbekistan", 1, "2026-06-17"], ["K", 1, "Portugal", 1, "DR Congo", 1, "2026-06-17"],
  ["L", 1, "England", 4, "Croatia", 2, "2026-06-17"], ["L", 1, "Ghana", 1, "Panama", 0, "2026-06-17"],
];

// 待赛（强制对阵，由"谁还没碰过谁"推导）：[组, 轮次, 主, 客, 日期]
const upcoming = [
  ["J", 2, "Algeria", "Jordan", "2026-06-23"],
  ["K", 2, "Portugal", "Uzbekistan", "2026-06-23"], ["K", 2, "Colombia", "DR Congo", "2026-06-23"],
  ["L", 2, "England", "Ghana", "2026-06-23"], ["L", 2, "Panama", "Croatia", "2026-06-23"],
  ["A", 3, "Mexico", "Czechia", "2026-06-24"], ["A", 3, "South Korea", "South Africa", "2026-06-24"],
  ["B", 3, "Canada", "Switzerland", "2026-06-24"], ["B", 3, "Bosnia and Herzegovina", "Qatar", "2026-06-24"],
  ["C", 3, "Brazil", "Scotland", "2026-06-25"], ["C", 3, "Morocco", "Haiti", "2026-06-25"],
  ["D", 3, "United States", "Türkiye", "2026-06-25"], ["D", 3, "Australia", "Paraguay", "2026-06-25"],
  ["E", 3, "Germany", "Ecuador", "2026-06-26"], ["E", 3, "Ivory Coast", "Curaçao", "2026-06-26"],
  ["F", 3, "Netherlands", "Tunisia", "2026-06-26"], ["F", 3, "Japan", "Sweden", "2026-06-26"],
  ["G", 3, "Belgium", "New Zealand", "2026-06-27"], ["G", 3, "Iran", "Egypt", "2026-06-27"],
  ["H", 3, "Spain", "Uruguay", "2026-06-27"], ["H", 3, "Cape Verde", "Saudi Arabia", "2026-06-27"],
  ["I", 3, "France", "Norway", "2026-06-28"], ["I", 3, "Senegal", "Iraq", "2026-06-28"],
  ["J", 3, "Argentina", "Jordan", "2026-06-28"], ["J", 3, "Austria", "Algeria", "2026-06-28"],
  ["K", 3, "Colombia", "Portugal", "2026-06-29"], ["K", 3, "Uzbekistan", "DR Congo", "2026-06-29"],
  ["L", 3, "England", "Panama", "2026-06-29"], ["L", 3, "Croatia", "Ghana", "2026-06-29"],
];

// 射手榜（快照模式为示例数据，进球数不超过各队总进球；真·实时由 API 提供）
const scorers = [
  ["Erling Haaland", "Norway", 4, 0], ["Kylian Mbappé", "France", 4, 1], ["Harry Kane", "England", 3, 1],
  ["Florian Wirtz", "Germany", 3, 0], ["Niclas Füllkrug", "Germany", 3, 0], ["Cody Gakpo", "Netherlands", 3, 0],
  ["Lionel Messi", "Argentina", 3, 0], ["Christian Pulisic", "United States", 3, 1], ["Takefusa Kubo", "Japan", 2, 0],
  ["Viktor Gyökeres", "Sweden", 2, 0], ["Mohamed Salah", "Egypt", 2, 1], ["Vinícius Júnior", "Brazil", 2, 0],
  ["Julián Álvarez", "Argentina", 2, 0], ["Folarin Balogun", "United States", 2, 0], ["Memphis Depay", "Netherlands", 2, 0],
  ["Hakim Ziyech", "Morocco", 2, 1], ["Dušan Vlahović", "Croatia", 1, 0], ["Bruno Fernandes", "Portugal", 1, 1],
];

// ---- 构建 ----
let matchId = 1000;
const matches = [];
for (const [g, md, h, hs, a, as, date] of finished) {
  matches.push({
    id: ++matchId, utcDate: `${date}T12:00:00Z`, status: "FINISHED", matchday: md,
    stage: "GROUP_STAGE", group: `GROUP_${g}`,
    homeTeam: team(h), awayTeam: team(a),
    score: { winner: hs > as ? "HOME_TEAM" : as > hs ? "AWAY_TEAM" : "DRAW", duration: "REGULAR", fullTime: { home: hs, away: as } },
  });
}
for (const [g, md, h, a, date] of upcoming) {
  matches.push({
    id: ++matchId, utcDate: `${date}T12:00:00Z`, status: "TIMED", matchday: md,
    stage: "GROUP_STAGE", group: `GROUP_${g}`,
    homeTeam: team(h), awayTeam: team(a),
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
  });
}

// 由已完赛推导积分榜
const groups = {};
for (const [g, , h, hs, a, as] of finished) {
  for (const name of [h, a]) (groups[g] ??= {})[name] ??= { name, playedGames: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0 };
  const H = groups[g][h], A = groups[g][a];
  H.playedGames++; A.playedGames++;
  H.goalsFor += hs; H.goalsAgainst += as; A.goalsFor += as; A.goalsAgainst += hs;
  if (hs > as) { H.won++; H.points += 3; A.lost++; }
  else if (as > hs) { A.won++; A.points += 3; H.lost++; }
  else { H.draw++; A.draw++; H.points++; A.points++; }
}

const standings = Object.keys(groups).sort().map((g) => {
  const rows = Object.values(groups[g]).map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst }));
  rows.sort((x, y) => y.points - x.points || y.goalDifference - x.goalDifference || y.goalsFor - x.goalsFor || x.name.localeCompare(y.name));
  return {
    stage: "GROUP_STAGE", type: "TOTAL", group: `GROUP_${g}`,
    table: rows.map((r, i) => ({
      position: i + 1, team: team(r.name), playedGames: r.playedGames, form: null,
      won: r.won, draw: r.draw, lost: r.lost, points: r.points,
      goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, goalDifference: r.goalDifference,
    })),
  };
});

const snapshot = {
  _meta: {
    source: "snapshot",
    asOf: "2026-06-23",
    note: "赛果与积分为真实数据（截至 2026-06-23，交叉验证自 NBC/ESPN）；射手榜为示例数据，真·实时请配置 FOOTBALL_DATA_TOKEN。",
  },
  competition: { id: 2000, code: "WC", name: "FIFA World Cup", type: "CUP", emblem: "https://crests.football-data.org/qatar.png" },
  standings: { competition: { id: 2000, code: "WC", name: "FIFA World Cup" }, season: { id: 2026, startDate: "2026-06-11", endDate: "2026-07-19", currentMatchday: 3 }, standings },
  scorers: {
    count: scorers.length,
    competition: { id: 2000, code: "WC", name: "FIFA World Cup" },
    scorers: scorers.map(([name, tname, goals, penalties], i) => ({
      player: { id: 9000 + i, name, nationality: tname }, team: team(tname),
      playedMatches: 2, goals, assists: 0, penalties,
    })),
  },
  matches: { competition: { id: 2000, code: "WC", name: "FIFA World Cup" }, resultSet: { count: matches.length }, matches },
};

writeFileSync(join(__dirname, "snapshot.json"), JSON.stringify(snapshot, null, 2));
console.log(`snapshot.json 生成完成：${matches.length} 场比赛，${standings.length} 组，${scorers.length} 名射手`);
