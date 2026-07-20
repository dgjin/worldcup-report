import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MatchGoal, MatchRaw } from "../types/worldcup";
import ChampionMoment from "./ChampionMoment";

const champion = readFileSync(new URL("./ChampionMoment.tsx", import.meta.url), "utf8");
const standings = readFileSync(new URL("./GroupStandings.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

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
assert.match(champion, /useChampionPhotos/);
assert.doesNotMatch(champion, /useAllGalleryPhotos|\buseGallery\b/);

const finalWithoutGoals: MatchRaw = {
  id: 20260719,
  utcDate: "2026-07-19T20:00:00Z",
  status: "FINISHED",
  matchday: null,
  stage: "FINAL",
  group: null,
  homeTeam: { id: 760, name: "Spain" },
  awayTeam: { id: 1, name: "Opponent" },
  score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } },
  goals: [],
};
const goal = (minute: number, type: MatchGoal["type"] = "REGULAR"): MatchGoal => ({
  minute,
  type,
  team: { id: 760, name: "Spain" },
  scorer: { id: minute, name: `Player ${minute}` },
});
const missingGoalsMarkup = renderToStaticMarkup(createElement(ChampionMoment, { matches: [finalWithoutGoals] }));
assert.match(missingGoalsMarkup, /进球信息同步中/);
const absentGoalsMarkup = renderToStaticMarkup(createElement(ChampionMoment, {
  matches: [{ ...finalWithoutGoals, goals: undefined }],
}));
assert.match(absentGoalsMarkup, /进球信息同步中/);
const zeroZeroMarkup = renderToStaticMarkup(createElement(ChampionMoment, {
  matches: [{
    ...finalWithoutGoals,
    score: { winner: "DRAW", fullTime: { home: 0, away: 0 } },
    goals: [],
  }],
}));
assert.doesNotMatch(zeroZeroMarkup, /进球信息同步中/);
const partialGoalsMarkup = renderToStaticMarkup(createElement(ChampionMoment, {
  matches: [{ ...finalWithoutGoals, goals: [goal(12), goal(54, "OWN_GOAL")] }],
}));
assert.match(partialGoalsMarkup, /进球信息同步中/);
const completeGoalsMarkup = renderToStaticMarkup(createElement(ChampionMoment, {
  matches: [{ ...finalWithoutGoals, goals: [goal(12), goal(54, "OWN_GOAL"), goal(78)] }],
}));
assert.doesNotMatch(completeGoalsMarkup, /进球信息同步中/);
assert.match(champion, /hasIncompleteGoalEvents\(match\)/);

assert.doesNotMatch(champion, /\buseEffect\b/);
assert.match(champion, /failedPhotoId/);
assert.match(champion, /failedPhotoId === photo\.id/);
assert.match(champion, /setFailedPhotoId\(photo\.id\)/);
assert.doesNotMatch(champion, /setLoadedPhotoId\(null\)|setPhotoFailed\(false\)/);

assert.match(champion, /srcSet=/);
assert.match(champion, /sizes=/);
assert.match(champion, /width=\{photo\.width > 0 \? photo\.width : undefined\}/);
assert.match(champion, /height=\{photo\.height > 0 \? photo\.height : undefined\}/);
assert.doesNotMatch(champion, /text-\[10px\]|\btext-xs\b|\btext-sm\b/);
assert.match(champion, /min-h-11[^"\n]*text-base|text-base[^"\n]*min-h-11/);

const ribbonRule = css.match(/\.champion-ribbon \{([\s\S]*?)\n\}/)?.[1] ?? "";
assert.match(
  ribbonRule,
  /transform:\s*translateX\(0\) rotate\(var\(--champion-ribbon-angle\)\) scaleX\(var\(--champion-ribbon-scale\)\)/,
  "ribbon final transform must exist outside animation keyframes",
);
console.log("ChampionMoment source contract tests passed");
