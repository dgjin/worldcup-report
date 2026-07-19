import assert from "node:assert/strict";
import type { GalleryPhoto } from "../api/gallery";
import type { MatchRaw } from "../types/worldcup";
import { findSpainFinal, selectSpainCeremonyPhoto } from "./champion";

const final = (overrides: Partial<MatchRaw> = {}): MatchRaw => ({
  id: 1,
  utcDate: "2026-07-19T20:00:00Z",
  status: "FINISHED",
  matchday: null,
  stage: "FINAL",
  group: null,
  homeTeam: { id: 760, name: "Spain" },
  awayTeam: { id: 1, name: "Opponent" },
  score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } },
  ...overrides,
});

const photo = (id: number, alt: string, width = 1600, height = 900): GalleryPhoto => ({
  id,
  alt,
  width,
  height,
  photographer: "Reuters",
  url: `https://example.com/${id}`,
  src: {
    large: `https://img.example.com/${id}-l.jpg`,
    medium: `https://img.example.com/${id}-m.jpg`,
    small: `https://img.example.com/${id}-s.jpg`,
  },
});

assert.equal(findSpainFinal([final({ stage: "SEMI_FINALS" })]), null);
assert.equal(findSpainFinal([final({ status: "TIMED" })]), null);
assert.equal(findSpainFinal([final({ id: 1 }), final({ id: 2, utcDate: "2026-07-20T01:00:00Z" })])?.id, 2);
assert.equal(selectSpainCeremonyPhoto([photo(1, "2026 World Cup highlights")]), null);
assert.equal(selectSpainCeremonyPhoto([photo(1, "Spain celebrates a goal")]), null);
assert.equal(selectSpainCeremonyPhoto([photo(1, "Spain lift the World Cup trophy")])?.id, 1);
assert.equal(selectSpainCeremonyPhoto([
  photo(1, "Spanish champions lift the trophy", 900, 1400),
  photo(2, "Spain crowned champions with trophy", 1600, 900),
])?.id, 2);

console.log("champion selector tests passed");
