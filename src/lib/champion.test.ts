import assert from "node:assert/strict";
import type { GalleryPhoto } from "../api/gallery";
import type { MatchGoal, MatchRaw } from "../types/worldcup";
import { CURATED_SPAIN_CHAMPION_PHOTO, findChampionGalleryPhoto, findSpainFinal, selectSpainCeremonyPhoto } from "./champion";

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

const goal = (minute: number, type: MatchGoal["type"] = "REGULAR"): MatchGoal => ({
  minute,
  type,
  team: { id: 760, name: "Spain" },
  scorer: { id: minute, name: `Player ${minute}` },
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
assert.equal(selectSpainCeremonyPhoto([
  photo(1, "Spain crowned champions with trophy", 900, 1400),
  photo(2, "Spain crowned champions with trophy", 1200, 0),
])?.id, 1, "unknown height must not receive a landscape bonus");

assert.equal(CURATED_SPAIN_CHAMPION_PHOTO.photographer, "Juan Mabromata/AFP via Getty Images");
assert.match(CURATED_SPAIN_CHAMPION_PHOTO.alt, /Rodri.*lifts the trophy/i);
assert.match(CURATED_SPAIN_CHAMPION_PHOTO.src.large, /ad56e011-7a81-433b-b446-683f812a9b0d/);
assert.equal(
  CURATED_SPAIN_CHAMPION_PHOTO.url,
  "https://abcnews.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564",
);

const abortTimeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
assert.ok(abortTimeoutDescriptor, "the runtime must provide AbortSignal.timeout");
const timeoutSignal = AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
let requestedTimeoutMs: number | undefined;
let receivedSignal: AbortSignal | null | undefined;

Object.defineProperty(AbortSignal, "timeout", {
  ...abortTimeoutDescriptor,
  value(milliseconds: number) {
    requestedTimeoutMs = milliseconds;
    return timeoutSignal;
  },
});

try {
  const timedOutResult = await findChampionGalleryPhoto([], "news-key", async (_input, init) => {
    receivedSignal = init?.signal;
    if (receivedSignal?.aborted) throw receivedSignal.reason;
    return new Response(JSON.stringify({ articles: [] }));
  });

  assert.equal(receivedSignal, timeoutSignal, "the NewsAPI fallback fetch must receive its timeout signal");
  assert.ok(
    typeof requestedTimeoutMs === "number" && requestedTimeoutMs > 0 && requestedTimeoutMs <= 10_000,
    "the NewsAPI fallback timeout must be finite, positive, and short",
  );
  assert.deepEqual(timedOutResult, { photo: null, source: null }, "a timed-out fallback must fail closed");
} finally {
  Object.defineProperty(AbortSignal, "timeout", abortTimeoutDescriptor);
}

const championApi = await import("./champion");
const exportedApi = championApi as Record<string, unknown>;
assert.equal(
  typeof exportedApi.hasIncompleteGoalEvents,
  "function",
  "champion helpers should expose score-relative goal-event completeness",
);
const hasIncompleteGoalEvents = exportedApi.hasIncompleteGoalEvents as (match: MatchRaw) => boolean;

assert.equal(hasIncompleteGoalEvents(final({
  score: { winner: "DRAW", fullTime: { home: 0, away: 0 } },
  goals: [],
})), false, "a 0-0 final needs no goal events");
assert.equal(hasIncompleteGoalEvents(final({
  score: { winner: "HOME_TEAM", fullTime: { home: 1, away: 0 } },
  goals: undefined,
})), true, "a 1-0 final is incomplete without its goal event");
assert.equal(hasIncompleteGoalEvents(final({ goals: [goal(12), goal(54, "OWN_GOAL")] })), true,
  "a 2-1 final with only two goal events remains incomplete");
assert.equal(hasIncompleteGoalEvents(final({ goals: [goal(12), goal(54, "OWN_GOAL"), goal(78)] })), false,
  "own goals count as score events when the event total is complete");
assert.equal(hasIncompleteGoalEvents(final({
  score: { winner: null, fullTime: { home: null, away: null } },
  goals: [],
})), false, "goal completeness is unknown until the numeric score arrives");

console.log("champion selector tests passed");
