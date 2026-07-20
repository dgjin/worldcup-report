# Champion Photo Credit Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the champion photo credit at 12px while preserving its 44px touch target and every other champion text size.

**Architecture:** Change the existing Tailwind class on the credit link only. Update the executable source-contract test to permit `text-xs` exclusively on that link and retain the existing browser regression for mobile layout and contrast.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Node assertions, headless Chrome, Vite 6.

## Global Constraints

- Only the champion photo credit changes from 16px to 12px.
- Keep `min-h-11`, link color, hover underline, photographer copy, URL, and loaded-photo visibility behavior unchanged.
- Keep all other champion body copy at 16px or larger.
- Do not modify data selection, image loading, score rendering, CSS artwork, or external-link behavior.

---

### Task 1: Reduce the Champion Photo Credit Size

**Files:**
- Modify: `src/views/ChampionMoment.test.ts:83-84`
- Modify: `src/views/ChampionMoment.tsx:164-172`
- Test: `src/views/ChampionMoment.test.ts`
- Test: `src/views/ChampionMoment.mobile.test.ts`

**Interfaces:**
- Consumes: the existing loaded-photo credit `<a>` rendered by `ChampionMoment`.
- Produces: a 12px credit link with the existing 44px minimum touch height and unchanged behavior.

- [ ] **Step 1: Write the failing source-contract assertions**

Replace the existing two size assertions with a focused credit-link contract:

```ts
assert.doesNotMatch(champion, /text-\[10px\]|\btext-sm\b/);
assert.match(
  champion,
  /className="[^"]*min-h-11[^"]*text-xs[^"]*"[\s\S]*?摄影\/来源：\{photo\.photographer\}/,
  "photo credit must use 12px text while retaining a 44px touch target",
);
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: FAIL with `photo credit must use 12px text while retaining a 44px touch target` because the link still uses `text-base`.

- [ ] **Step 3: Implement the 12px credit link**

In `ChampionMoment.tsx`, change only the credit link class from `text-base` to `text-xs`:

```tsx
className="mt-4 inline-flex min-h-11 items-center text-xs text-white/60 underline-offset-2 transition-colors hover:text-white/85 hover:underline"
```

- [ ] **Step 4: Run the focused test and verify it turns green**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: `ChampionMoment source contract tests passed`.

- [ ] **Step 5: Run the mobile browser regression**

Run: `npx tsx src/views/ChampionMoment.mobile.test.ts`

Expected: `ChampionMoment 375px layout regression passed` with no overflow or contrast failure.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: every test exits 0, Vite reports a successful production build, and `git diff --check` has no output.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/views/ChampionMoment.tsx src/views/ChampionMoment.test.ts
git commit -m "style: reduce champion photo credit size"
```
