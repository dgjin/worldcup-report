# Spain Champion Moment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standings page “今日速递” with a responsive red-and-gold Spain champion celebration that shows real final data and automatically adopts a high-confidence ceremony photo.

**Architecture:** Add pure champion-selection functions in a focused library module, cover them with executable TypeScript assertions, and render the result in a dedicated `ChampionMoment` view component. `GroupStandings` composes the new component; global CSS owns the decorative, theme-aware and reduced-motion styles.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, motion/react, lucide-react, Vite 6.

## Global Constraints

- Do not add dependencies, external image services, interface keys, audio, video, downloads, or global celebration effects.
- Do not hard-code or infer a final score, scorer, or match time.
- A ceremony image must match both Spain semantics and champion/ceremony semantics; generic World Cup imagery must not qualify.
- Show photographer/media credit and the original article link for an automatically selected photo.
- Preserve a complete CSS red-and-gold fallback when no photo qualifies or an image fails to load.
- Build mobile-first at 375px, support light and dark themes, and disable decorative motion under `prefers-reduced-motion: reduce`.

---

### Task 1: Champion Data and Photo Selectors

**Files:**
- Create: `src/lib/champion.ts`
- Create: `src/lib/champion.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `MatchRaw` from `src/types/worldcup.ts` and `GalleryPhoto` from `src/api/gallery.ts`.
- Produces: `findSpainFinal(matches: MatchRaw[]): MatchRaw | null` and `selectSpainCeremonyPhoto(photos: GalleryPhoto[]): GalleryPhoto | null`.

- [ ] **Step 1: Write failing selector tests**

Create fixtures with the smallest valid `MatchRaw` and `GalleryPhoto` shapes. Assert that `findSpainFinal` selects only the newest `FINISHED` match whose `stage === "FINAL"` and whose home or away name normalizes to `spain`; assert it returns `null` for a semifinal or unfinished final. Assert that `selectSpainCeremonyPhoto` accepts `Spain lift the World Cup trophy`, rejects generic `2026 World Cup highlights`, rejects `Spain celebrates a goal`, and prefers a landscape candidate over a portrait candidate when both have the two required semantic groups.

```ts
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
  src: { large: `https://img.example.com/${id}-l.jpg`, medium: `https://img.example.com/${id}-m.jpg`, small: `https://img.example.com/${id}-s.jpg` },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/champion.test.ts`

Expected: FAIL with `Cannot find module './champion'`.

- [ ] **Step 3: Implement the pure selectors**

Create `src/lib/champion.ts`. Normalize searchable text with `.toLocaleLowerCase("en")`; require at least one Spain token and at least one ceremony token. Score semantic token matches first, then add one point for `width / height >= 1.35`; preserve input order for equal scores. Filter finals by normalized team name, exact `FINAL` stage, and `FINISHED` status, then sort a copied array by descending `utcDate`.

```ts
import type { GalleryPhoto } from "../api/gallery";
import type { MatchRaw } from "../types/worldcup";

const SPAIN_TERMS = ["spain", "spanish", "西班牙"];
const CEREMONY_TERMS = ["champion", "trophy", "lift", "crown", "冠军", "捧杯", "颁奖"];

export function findSpainFinal(matches: MatchRaw[]): MatchRaw | null {
  return [...matches]
    .filter((match) => match.status === "FINISHED" && match.stage === "FINAL")
    .filter((match) => [match.homeTeam.name, match.awayTeam.name].some((name) => name.trim().toLowerCase() === "spain"))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))[0] ?? null;
}

export function selectSpainCeremonyPhoto(photos: GalleryPhoto[]): GalleryPhoto | null {
  const ranked = photos.flatMap((photo, index) => {
    const text = `${photo.alt} ${photo.url}`.toLocaleLowerCase("en");
    const spainHits = SPAIN_TERMS.filter((term) => text.includes(term)).length;
    const ceremonyHits = CEREMONY_TERMS.filter((term) => text.includes(term)).length;
    if (spainHits === 0 || ceremonyHits === 0) return [];
    return [{ photo, index, score: spainHits * 10 + ceremonyHits * 10 + (photo.width / photo.height >= 1.35 ? 1 : 0) }];
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.photo ?? null;
}
```

- [ ] **Step 4: Add selector tests to the project test command and verify**

Change the `test` script so it begins with `tsx src/lib/champion.test.ts &&`. Run `npm test`.

Expected: `champion selector tests passed` followed by all existing passing test messages.

- [ ] **Step 5: Commit the selector task**

```bash
git add src/lib/champion.ts src/lib/champion.test.ts package.json
git commit -m "feat: select Spain final and ceremony photo"
```

### Task 2: Champion Moment Component

**Files:**
- Create: `src/views/ChampionMoment.tsx`
- Modify: `src/views/GroupStandings.tsx`
- Create: `src/views/ChampionMoment.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `findSpainFinal`, `selectSpainCeremonyPhoto`, `SplitMatches.all`, `useGallery`, `Flag`, `teamZh`, `playerZh`, and `GalleryPhoto` credit fields.
- Produces: `ChampionMoment({ matches }: { matches: MatchRaw[] }): JSX.Element`.

- [ ] **Step 1: Write the failing component source-contract test**

Create an executable source test that asserts `ChampionMoment.tsx` includes the exact strings `夺冠时刻`, `冠军属于西班牙`, `CAMPEONES`, `决赛战报同步中`, `摄影`, `findSpainFinal`, and `selectSpainCeremonyPhoto`; assert `GroupStandings.tsx` imports/renders `ChampionMoment` and no longer includes `TodayBriefing`, `今日速递`, or `最新战况`.

```ts
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
console.log("ChampionMoment source contract tests passed");
```

- [ ] **Step 2: Run the component contract test to verify it fails**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: FAIL because `ChampionMoment.tsx` does not exist.

- [ ] **Step 3: Build the semantic champion layout**

Implement `ChampionMoment` as a `<section aria-labelledby="champion-moment-title">`. Call `useGallery()`, memoize both selectors, and keep local `photoFailed` state keyed to the selected photo ID. Render:

- A small `夺冠时刻` eyebrow and four decorative stars.
- A main `h2` with visually dominant `西班牙` plus `冠军属于西班牙` and `CAMPEONES`.
- A lucide `Trophy` focal point with `Crown` detail and decorative rays/ribbons marked `aria-hidden="true"`.
- An absolutely positioned `<img>` only when a photo qualifies and has not failed; `onError={() => setPhotoFailed(true)}` restores the fallback.
- A credit link with `target="_blank"`, `rel="noreferrer"`, `摄影/来源：{photo.photographer}`, shown only for a successfully loaded selected image.
- A final score strip using the actual `findSpainFinal` result. Reuse `Flag`, `teamZh`, and a local scorer grouping that filters `goals` by team ID and renders minute, localized scorer, penalty and own-goal markers. When no final exists, render `决赛战报同步中`.

Use `motion.section` and `motion.div` with a single entrance sequence and no looping animation. Keep all meaningful copy as text rather than pseudo-elements.

- [ ] **Step 4: Replace TodayBriefing in GroupStandings**

Remove `todayMatches`, `timeLabel`, `Card` usage that only served the briefing, and the `TodayBriefing`/`MatchLine` definitions from `GroupStandings.tsx`. Import the new component and render:

```tsx
<ChampionMoment matches={matches.all} />
```

Keep `GoalStrip` only if it is still used; otherwise move its scorer formatting into `ChampionMoment.tsx` and remove unused `MatchGoal`, `MatchRaw`, `playerZh`, and related imports from `GroupStandings.tsx`.

- [ ] **Step 5: Add the contract test to the project suite and verify type safety**

Add `tsx src/views/ChampionMoment.test.ts &&` to the `test` script after the selector test. Run:

```bash
npm test
npm run lint
```

Expected: all test messages pass and `tsc --noEmit` exits 0.

- [ ] **Step 6: Commit the component task**

```bash
git add src/views/ChampionMoment.tsx src/views/ChampionMoment.test.ts src/views/GroupStandings.tsx package.json
git commit -m "feat: replace daily briefing with Spain champion moment"
```

### Task 3: Red Coronation Styling and Production Verification

**Files:**
- Modify: `src/index.css`
- Modify: `src/views/ChampionMoment.tsx`

**Interfaces:**
- Consumes: stable class hooks emitted by `ChampionMoment`: `champion-moment`, `champion-radiance`, `champion-ribbon`, `champion-particle`, and `champion-photo`.
- Produces: theme-aware CSS artwork, responsive layout behavior, image treatment, and reduced-motion behavior.

- [ ] **Step 1: Add stable class hooks to the component**

Apply semantic classes to the root, background image, radiance, two ribbons, and a fixed set of decorative particles. Keep Tailwind utilities for layout; use CSS hooks only for artwork that would be unreadable as long utility strings.

- [ ] **Step 2: Implement the red-and-gold artwork**

In `src/index.css`, define component-scoped CSS custom properties and backgrounds:

```css
.champion-moment {
  --champion-red: #aa151b;
  --champion-red-deep: #4a0710;
  --champion-gold: #f1bf00;
  isolation: isolate;
  background:
    radial-gradient(circle at 72% 34%, rgb(241 191 0 / 20%), transparent 28%),
    linear-gradient(125deg, #24030a 0%, var(--champion-red-deep) 45%, #7d0c17 100%);
}

.champion-photo {
  filter: saturate(.88) contrast(1.06);
  mask-image: linear-gradient(90deg, transparent 0%, #000 36%, #000 100%);
}
```

Add a repeating-conic radiance, angled red/yellow ribbon shapes, a subtle noise-like overlay made from layered CSS gradients, and one-shot `champion-rise`/`champion-sweep` keyframes. Scope light-theme overrides beneath `html[data-theme="light"] .champion-moment` without making the hero pale.

- [ ] **Step 3: Add responsive and reduced-motion rules**

Make the photo mask vertical-first below 640px and horizontal from 640px upward. Keep the hero min-height compact enough that the score strip remains visible near the first viewport. Under `@media (prefers-reduced-motion: reduce)`, set animation to `none !important` and transition duration to `0.01ms !important` for champion decoration classes.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass; TypeScript exits 0; Vite reports a successful production build; `git diff --check` has no output.

- [ ] **Step 5: Inspect the responsive result**

Start `npm run dev`, inspect the standings page at 375×812 and 1440×900 in both themes, and verify: no horizontal overflow; title and score are readable with and without a photo; credit is visible only with a loaded photo; the fallback has no empty area; reduced-motion removes decorative animation.

- [ ] **Step 6: Commit the styling task**

```bash
git add src/index.css src/views/ChampionMoment.tsx
git commit -m "style: add red coronation artwork"
```

### Task 4: Final Regression Review

**Files:**
- Review only: all files changed in Tasks 1–3.

**Interfaces:**
- Consumes: completed champion selectors, component, and styles.
- Produces: verified working tree ready for handoff.

- [ ] **Step 1: Compare implementation with every design acceptance criterion**

Confirm all eight criteria in `docs/superpowers/specs/2026-07-20-spain-champion-moment-design.md`, including both photo and no-photo paths.

- [ ] **Step 2: Review the final diff for accidental scope expansion**

Run `git diff HEAD~3 -- src package.json` and confirm no navigation, standings data, fan talk, visits, gallery refresh, or likes behavior changed.

- [ ] **Step 3: Re-run clean verification**

Run `npm test && npm run lint && npm run build`.

Expected: all commands exit 0 with no failing assertion or TypeScript/build error.
