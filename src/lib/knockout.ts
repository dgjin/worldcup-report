import type { ApiTeam, MatchRaw } from "../types/worldcup";

const PROGRESSION = [
  { from: "LAST_32", to: "LAST_16" },
  { from: "LAST_16", to: "QUARTER_FINALS" },
  { from: "QUARTER_FINALS", to: "SEMI_FINALS" },
  { from: "SEMI_FINALS", to: "FINAL" },
] as const;

function knownTeam(team: ApiTeam | null | undefined): team is ApiTeam {
  if (!team) return false;
  const name = team.name.trim();
  return Boolean(name && !/^tbd$/i.test(name) && name !== "待定" && team.id !== 0);
}

function winnerOf(match: MatchRaw | undefined): ApiTeam | null {
  if (!match) return null;
  if (match.status !== "FINISHED") return null;
  if (match.score.winner === "HOME_TEAM" && knownTeam(match.homeTeam)) return match.homeTeam;
  if (match.score.winner === "AWAY_TEAM" && knownTeam(match.awayTeam)) return match.awayTeam;
  return null;
}

function loserOf(match: MatchRaw | undefined): ApiTeam | null {
  if (!match) return null;
  if (match.status !== "FINISHED") return null;
  if (match.score.winner === "HOME_TEAM" && knownTeam(match.awayTeam)) return match.awayTeam;
  if (match.score.winner === "AWAY_TEAM" && knownTeam(match.homeTeam)) return match.homeTeam;
  return null;
}

function applyTeams(match: MatchRaw, homeTeam: ApiTeam | null, awayTeam: ApiTeam | null): MatchRaw {
  const nextHome = knownTeam(match.homeTeam) ? match.homeTeam : homeTeam ?? match.homeTeam;
  const nextAway = knownTeam(match.awayTeam) ? match.awayTeam : awayTeam ?? match.awayTeam;
  if (nextHome === match.homeTeam && nextAway === match.awayTeam) return match;
  return { ...match, homeTeam: nextHome, awayTeam: nextAway };
}

function byDate(a: MatchRaw, b: MatchRaw): number {
  return a.utcDate.localeCompare(b.utcDate) || a.id - b.id;
}

export function applyKnockoutProgression(matches: MatchRaw[]): MatchRaw[] {
  const next = [...matches];

  for (const { from, to } of PROGRESSION) {
    const previous = next.filter((m) => m.stage === from).sort(byDate);
    const target = next.filter((m) => m.stage === to).sort(byDate);

    for (let i = 0; i < target.length; i++) {
      const homeTeam = winnerOf(previous[i * 2]);
      const awayTeam = winnerOf(previous[i * 2 + 1]);
      const inferred = applyTeams(target[i], homeTeam, awayTeam);
      if (inferred !== target[i]) {
        next[next.indexOf(target[i])] = inferred;
      }
    }
  }

  const semiFinals = next.filter((m) => m.stage === "SEMI_FINALS").sort(byDate);
  const thirdPlace = next.filter((m) => m.stage === "THIRD_PLACE").sort(byDate)[0];
  if (thirdPlace) {
    const inferred = applyTeams(thirdPlace, loserOf(semiFinals[0]), loserOf(semiFinals[1]));
    if (inferred !== thirdPlace) {
      next[next.indexOf(thirdPlace)] = inferred;
    }
  }

  return next;
}
