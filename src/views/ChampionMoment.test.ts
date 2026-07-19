import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const champion = readFileSync(new URL("./ChampionMoment.tsx", import.meta.url), "utf8");
const standings = readFileSync(new URL("./GroupStandings.tsx", import.meta.url), "utf8");

for (const text of ["夺冠时刻", "冠军属于西班牙", "CAMPEONES", "决赛战报同步中", "摄影", "findSpainFinal", "selectSpainCeremonyPhoto"]) {
  assert.ok(champion.includes(text), `ChampionMoment should include ${text}`);
}
assert.match(standings, /import ChampionMoment from "\.\/ChampionMoment"/);
assert.match(standings, /<ChampionMoment matches=\{matches\.all\} \/>/);
assert.doesNotMatch(standings, /TodayBriefing|今日速递|最新战况/);

assert.doesNotMatch(champion, /fullTime\.home\s*\?\?\s*0|fullTime\.away\s*\?\?\s*0/);
assert.match(champion, /typeof homeScore === "number" && typeof awayScore === "number"/);
assert.match(champion, /比分同步中/);

assert.match(champion, /useReducedMotion/);
assert.match(champion, /initial=\{shouldReduceMotion \? false : "hidden"\}/);
assert.match(champion, /animate=\{shouldReduceMotion \? false : "visible"\}/);
console.log("ChampionMoment source contract tests passed");
