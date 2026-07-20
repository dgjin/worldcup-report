# Champion Score Deemphasis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the incomplete-goal warning and give the final score area a quieter, medium-deemphasis treatment.

**Architecture:** Keep `FinalScore` and its data rendering structure intact. Remove only the warning-specific completeness calculation and markup, then adjust existing Tailwind classes on the score card, team names, scorers, and main score; protect both behaviors with executable source and server-render assertions.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Node assertions, React server rendering, headless Chrome, Vite 6.

## Global Constraints

- Never render `进球信息同步中`.
- Continue rendering any available goal events without completeness warnings.
- Preserve `比分同步中` and `决赛战报同步中` under their existing conditions.
- Do not modify `hasIncompleteGoalEvents` in `src/lib/champion.ts` or its independent tests.
- Do not change champion photography, title, credit, final selection, gallery behavior, or image fallback.

---

### Task 1: Remove the Incomplete-Goal Warning

**Files:**
- Modify: `src/views/ChampionMoment.test.ts:45-72`
- Modify: `src/views/ChampionMoment.tsx:6-83`
- Test: `src/views/ChampionMoment.test.ts`

**Interfaces:**
- Consumes: `FinalScore({ match }: { match: MatchRaw })` and its existing server-render fixtures.
- Produces: a score area that renders available goals but never renders an incomplete-goal warning.

- [ ] **Step 1: Write failing warning-removal assertions**

Replace warning expectations for missing, absent, and partial goals with negative assertions, and add source-level guards:

```ts
assert.doesNotMatch(missingGoalsMarkup, /进球信息同步中/);
assert.doesNotMatch(absentGoalsMarkup, /进球信息同步中/);
assert.doesNotMatch(partialGoalsMarkup, /进球信息同步中/);
assert.doesNotMatch(champion, /进球信息同步中|hasIncompleteGoalEvents/);
```

Retain the `zeroZeroMarkup` and `completeGoalsMarkup` negative assertions. Add a positive check that the partial fixture still renders an existing scorer:

```ts
assert.match(partialGoalsMarkup, /Player 12/);
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: FAIL because `missingGoalsMarkup` still contains `进球信息同步中`.

- [ ] **Step 3: Remove warning-only component logic**

Remove `hasIncompleteGoalEvents` from the `../lib/champion` import, delete:

```ts
const goalInformationMissing = hasIncompleteGoalEvents(match);
```

and delete:

```tsx
{goalInformationMissing && (
  <p className="mt-2 text-base font-medium text-white/65">进球信息同步中</p>
)}
```

Do not change goal filtering or score fallback rendering.

- [ ] **Step 4: Run the focused test and verify it turns green**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: `ChampionMoment source contract tests passed`.

- [ ] **Step 5: Commit the warning removal**

```bash
git add src/views/ChampionMoment.tsx src/views/ChampionMoment.test.ts
git commit -m "fix: remove incomplete goal warning"
```

---

### Task 2: Apply Medium Score Deemphasis

**Files:**
- Modify: `src/views/ChampionMoment.test.ts`
- Modify: `src/views/ChampionMoment.tsx:20-78`
- Test: `src/views/ChampionMoment.test.ts`
- Test: `src/views/ChampionMoment.mobile.test.ts`

**Interfaces:**
- Consumes: existing Tailwind class strings on `Scorers`, the score-card root, team names, and main score row.
- Produces: the approved medium-deemphasis tokens without changing component structure.

- [ ] **Step 1: Write failing visual-contract assertions**

Add exact source assertions:

```ts
assert.match(champion, /border-white\/10 bg-black\/15/);
assert.match(champion, /backdrop-blur-sm/);
assert.doesNotMatch(champion, /shadow-2xl|backdrop-blur-md|border-white\/15|bg-black\/30/);
assert.match(champion, /font-display[^"\n]*text-white\/85/);
assert.equal((champion.match(/text-white\/80/g) ?? []).length, 2);
assert.match(champion, /text-base leading-snug text-white\/55/);
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: FAIL because the score card still uses `border-white/15 bg-black/30`, `shadow-2xl`, and `backdrop-blur-md`.

- [ ] **Step 3: Apply the approved Tailwind tokens**

Make these exact substitutions in `ChampionMoment.tsx`:

```text
text-white/65      -> text-white/55   (Scorers container only)
border-white/15    -> border-white/10
bg-black/30        -> bg-black/15
shadow-2xl         -> remove
backdrop-blur-md   -> backdrop-blur-sm
text-white         -> text-white/80   (two team-name spans only)
text-white         -> text-white/85   (main score row only)
```

Do not change the gold minute, penalty, own-goal, flag, or fallback text classes.

- [ ] **Step 4: Run focused and mobile tests**

Run:

```bash
npx tsx src/views/ChampionMoment.test.ts
npx tsx src/views/ChampionMoment.mobile.test.ts
```

Expected: both commands exit 0 and print their passing messages.

- [ ] **Step 5: Commit the visual treatment**

```bash
git add src/views/ChampionMoment.tsx src/views/ChampionMoment.test.ts
git commit -m "style: deemphasize champion score card"
```

---

### Task 3: Full Regression and Build Verification

**Files:**
- Review: `src/views/ChampionMoment.tsx`
- Review: `src/views/ChampionMoment.test.ts`

**Interfaces:**
- Consumes: the warning removal and medium-deemphasis commits.
- Produces: a verified branch ready for integration.

- [ ] **Step 1: Run all tests and the production build**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests exit 0, Vite reports a successful production build, and `git diff --check` has no output.

- [ ] **Step 2: Review final scope**

Run:

```bash
git diff HEAD~2 -- src/views/ChampionMoment.tsx src/views/ChampionMoment.test.ts
git status --short
```

Expected: only the warning markup/import/calculation, approved Tailwind tokens, and matching tests changed; the worktree is clean.
