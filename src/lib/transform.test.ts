// 用快照做 fixture，验证数据转换 / 战报生成。运行：npm test
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MatchesResponse, ScorersResponse, StandingsResponse } from "../types/worldcup";
import { bestThirdIds, goalsByGroup, splitMatches, toGroupTables, toScorers } from "./transform";
import { buildReports } from "./report";
import { teamZh } from "./teams";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(readFileSync(join(__dirname, "../../data/snapshot.json"), "utf-8")) as {
  standings: StandingsResponse;
  scorers: ScorersResponse;
  matches: MatchesResponse;
};

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

console.log("transform.test.ts");

// 小组赛积分榜
const groups = toGroupTables(snap.standings);
ok("12 个小组", groups.length === 12, `实际 ${groups.length}`);
ok("A..L 有序", groups.map((g) => g.letter).join("") === "ABCDEFGHIJKL");

const groupA = groups.find((g) => g.letter === "A")!;
ok("A 组头名是墨西哥 6 分", teamZh(groupA.table[0].team.name) === "墨西哥" && groupA.table[0].points === 6);
ok("每组 4 队", groups.every((g) => g.table.length === 4));

// I 组同分靠净胜球：法国(+5) 力压挪威(+4)
const groupI = groups.find((g) => g.letter === "I")!;
ok(
  "I 组净胜球排序正确（法国第一）",
  teamZh(groupI.table[0].team.name) === "法国" && groupI.table[0].goalDifference === 5,
);

// 最佳第三名 8 席
const thirds = bestThirdIds(groups);
ok("最佳第三名 8 席", thirds.size === 8, `实际 ${thirds.size}`);

// 射手榜
const scorers = toScorers(snap.scorers);
ok("射手榜按进球降序", scorers[0].goals >= scorers[1].goals && scorers[0].goals === 4);

// 比赛拆分
const sm = splitMatches(snap.matches);
ok("已赛+待赛=总场次", sm.finished.length + sm.upcoming.length === sm.all.length, `已赛 ${sm.finished.length} + 待赛 ${sm.upcoming.length} ≠ 总 ${sm.all.length}`);
ok("已赛场次>0", sm.finished.length > 0, `实际 ${sm.finished.length}`);
ok("待赛场次>0", sm.upcoming.length > 0, `实际 ${sm.upcoming.length}`);
ok("已赛按时间倒序", sm.finished[0].utcDate >= sm.finished[sm.finished.length - 1].utcDate);

// 图表数据
const gbg = goalsByGroup(groups);
ok("各组进球统计含 12 组", gbg.length === 12);
ok("E 组进球数=12（德国9+科特2+库拉索1）", gbg.find((x) => x.group === "E")!.goals === 12, JSON.stringify(gbg.find((x) => x.group === "E")));

// 战报文字
const reports = buildReports(snap.matches.matches);
ok("战报覆盖全部已赛", reports.length === sm.finished.length, `战报 ${reports.length} ≠ 已赛 ${sm.finished.length}`);
const ger = reports.find((r) => r.headline.includes("德国") && r.homeScore === 7);
ok("德国 7-1 标记血洗+进球大战", !!ger && ger.tags.includes("血洗") && ger.tags.includes("进球大战"), JSON.stringify(ger?.tags));
const draw00 = reports.find((r) => r.tags.includes("闷平"));
ok("存在闷平战报", !!draw00);

if (failed > 0) {
  console.error(`\n${failed} 个断言失败`);
  process.exit(1);
}
console.log("\n全部通过 ✓");
