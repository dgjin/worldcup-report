import assert from "node:assert/strict";
import type { ApiTeam, MatchRaw } from "../types/worldcup";
import { applyKnockoutProgression } from "./knockout";

const team = (id: number, name: string): ApiTeam => ({ id, name });
const TBD = team(0, "TBD");

function match(
  id: number,
  stage: string,
  homeTeam: ApiTeam,
  awayTeam: ApiTeam,
  winner: MatchRaw["score"]["winner"],
  status: MatchRaw["status"] = winner ? "FINISHED" : "TIMED",
): MatchRaw {
  return {
    id,
    stage,
    homeTeam,
    awayTeam,
    status,
    utcDate: `2026-07-${String(id).padStart(2, "0")}T12:00:00Z`,
    matchday: null,
    group: null,
    score: {
      winner,
      duration: "REGULAR",
      fullTime: {
        home: winner === "HOME_TEAM" ? 2 : winner === "AWAY_TEAM" ? 0 : null,
        away: winner === "AWAY_TEAM" ? 2 : winner === "HOME_TEAM" ? 0 : null,
      },
    },
  };
}

console.log("knockout.test.ts");

{
  const alpha = team(1, "Alpha");
  const delta = team(4, "Delta");
  const result = applyKnockoutProgression([
    match(1, "LAST_32", alpha, team(2, "Bravo"), "HOME_TEAM"),
    match(2, "LAST_32", team(3, "Charlie"), delta, "AWAY_TEAM"),
    match(3, "LAST_16", TBD, TBD, null),
  ]);

  const last16 = result.find((m) => m.stage === "LAST_16")!;
  assert.equal(last16.homeTeam.name, "Alpha");
  assert.equal(last16.awayTeam.name, "Delta");
}

{
  const official = team(9, "Official Host");
  const winner = team(10, "Winner Away");
  const result = applyKnockoutProgression([
    match(4, "LAST_32", team(7, "Winner Home"), team(8, "Loser Home"), "HOME_TEAM"),
    match(5, "LAST_32", team(11, "Loser Away"), winner, "AWAY_TEAM"),
    match(6, "LAST_16", official, TBD, null),
  ]);

  const last16 = result.find((m) => m.stage === "LAST_16")!;
  assert.equal(last16.homeTeam.name, "Official Host");
  assert.equal(last16.awayTeam.name, "Winner Away");
}

{
  const finalWinner = team(20, "Finalist");
  const thirdPlaceTeam = team(21, "Bronze Contender");
  const result = applyKnockoutProgression([
    match(7, "SEMI_FINALS", finalWinner, team(22, "Semi Loser A"), "HOME_TEAM"),
    match(8, "SEMI_FINALS", thirdPlaceTeam, team(23, "Semi Loser B"), "AWAY_TEAM"),
    match(9, "FINAL", TBD, TBD, null),
    match(10, "THIRD_PLACE", TBD, TBD, null),
  ]);

  const final = result.find((m) => m.stage === "FINAL")!;
  const thirdPlace = result.find((m) => m.stage === "THIRD_PLACE")!;
  assert.equal(final.homeTeam.name, "Finalist");
  assert.equal(final.awayTeam.name, "Semi Loser B");
  assert.equal(thirdPlace.homeTeam.name, "Semi Loser A");
  assert.equal(thirdPlace.awayTeam.name, "Bronze Contender");
}

console.log("全部通过 ✓");
