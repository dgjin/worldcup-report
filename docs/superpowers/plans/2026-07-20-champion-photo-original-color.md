# Champion Photo Original Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Spain champion photograph the dominant full-color visual while preserving readable foreground content and the existing red-and-gold fallback.

**Architecture:** Keep the React component and all data/loading behavior unchanged. Express the visual change entirely through the existing component-scoped hooks in `src/index.css`, with executable source-contract assertions in `src/views/ChampionMoment.test.ts` and the existing browser-based 375px regression as the layout guard.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, CSS, Vite 6, Node assertions, headless Chrome.

## Global Constraints

- Preserve the existing selected-photo, load-success credit, load-failure fallback, final score, and scorer behavior.
- Do not add dependencies, image services, animations, or new component markup.
- Keep the source photograph's natural color; do not use `mix-blend-mode: luminosity`, saturation reduction, or directional fade masks.
- Keep the champion text, score, and photo credit readable in light and dark themes.
- Keep the layout free of horizontal overflow at 375px.

---

### Task 1: Lock the Full-Color Photo Contract

**Files:**
- Modify: `src/views/ChampionMoment.test.ts`
- Test: `src/views/ChampionMoment.test.ts`

**Interfaces:**
- Consumes: `.champion-photo`, `.champion-radiance`, `.champion-ribbon`, and `.champion-vignette` rules from `src/index.css`.
- Produces: executable assertions that prevent the photo from returning to monochrome blending, low opacity, or directional masks.

- [ ] **Step 1: Write the failing CSS source-contract assertions**

Add `index.css` as a second source fixture and isolate the default photo rule before asserting the selected design:

```ts
const styles = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const photoRule = styles.match(/\.champion-photo\s*\{([^}]*)\}/)?.[1];
assert.ok(photoRule, "champion photo rule must exist");
assert.match(photoRule, /opacity:\s*0\.94/);
assert.match(photoRule, /filter:\s*none/);
assert.match(photoRule, /mix-blend-mode:\s*normal/);
assert.doesNotMatch(photoRule, /mask-image|-webkit-mask-image|luminosity|saturate\(/);
assert.match(styles, /\.champion-radiance\s*\{[^}]*opacity:\s*0\.32/s);
assert.match(styles, /\.champion-ribbon\s*\{[^}]*opacity:\s*0\.36/s);
```

- [ ] **Step 2: Run the focused test and verify the expected red state**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: FAIL because the current rule contains `opacity: 0.46`, `filter: saturate(...)`, `mix-blend-mode: luminosity`, and directional masks.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add src/views/ChampionMoment.test.ts
git commit -m "test: require original-color champion photo"
```

---

### Task 2: Make the Photograph the Primary Visual

**Files:**
- Modify: `src/index.css:140-349`
- Test: `src/views/ChampionMoment.test.ts`

**Interfaces:**
- Consumes: the existing `.champion-photo`, `.champion-radiance`, `.champion-ribbon`, `.champion-vignette`, and light-theme hooks rendered by `ChampionMoment`.
- Produces: a full-bleed, original-color champion photograph with restrained edge/bottom contrast layers and quieter decorations.

- [ ] **Step 1: Replace the default photo treatment**

Change `.champion-photo` to the following rule. Keep the existing `z-index`, `object-position`, and class name; remove both mask properties entirely:

```css
.champion-photo {
  z-index: 0;
  opacity: 0.94;
  object-position: 58% 30%;
  filter: none;
  mix-blend-mode: normal;
}
```

- [ ] **Step 2: Quiet the decorative layers**

Change the existing opacity declarations without changing their gradients, geometry, or animations:

```css
.champion-radiance {
  /* retain existing custom property, z-index, background, mask and animation */
  opacity: 0.32;
}

.champion-ribbon {
  /* retain existing geometry, background, transform and animation */
  opacity: 0.36;
}
```

Update the `champion-sweep` animation's final opacity to match the resting ribbon opacity:

```css
@keyframes champion-sweep {
  from {
    opacity: 0;
    transform: translateX(var(--champion-ribbon-from)) rotate(var(--champion-ribbon-angle)) scaleX(var(--champion-ribbon-scale));
  }
  to {
    opacity: 0.36;
    transform: translateX(0) rotate(var(--champion-ribbon-angle)) scaleX(var(--champion-ribbon-scale));
  }
}
```

- [ ] **Step 3: Restrict contrast treatment to edges and the lower content area**

Replace the existing `.champion-vignette` background while keeping its `z-index` and pointer behavior:

```css
.champion-vignette {
  z-index: 5;
  pointer-events: none;
  background:
    radial-gradient(circle at 58% 34%, transparent 0 34%, rgb(22 0 5 / 8%) 68%, rgb(20 0 5 / 34%) 100%),
    linear-gradient(180deg, rgb(15 0 4 / 4%) 0%, transparent 42%, rgb(20 0 5 / 58%) 100%);
}
```

- [ ] **Step 4: Keep light-theme photos unchanged and remove responsive masks**

Replace the light-theme photo override with:

```css
html[data-theme="light"] .champion-photo {
  opacity: 0.94;
  filter: none;
}
```

Inside `@media (min-width: 640px)`, keep only the desktop crop adjustment in `.champion-photo` and delete both mask declarations:

```css
.champion-photo {
  object-position: 68% center;
}
```

- [ ] **Step 5: Run the focused test and verify it turns green**

Run: `npx tsx src/views/ChampionMoment.test.ts`

Expected: `ChampionMoment source contract tests passed`.

- [ ] **Step 6: Run the mobile browser regression**

Run: `npx tsx src/views/ChampionMoment.mobile.test.ts`

Expected: `ChampionMoment 375px layout regression passed` with no overflow or contrast assertion failures.

- [ ] **Step 7: Commit the visual implementation**

```bash
git add src/index.css
git commit -m "style: feature original-color champion photo"
```

---

### Task 3: Full Regression and Production-Build Review

**Files:**
- Review: `src/index.css`
- Review: `src/views/ChampionMoment.test.ts`

**Interfaces:**
- Consumes: the completed CSS treatment and test contract.
- Produces: a verified commit sequence ready for deployment.

- [ ] **Step 1: Run all executable tests**

Run: `npm test`

Expected: all test commands exit 0, including `ChampionMoment source contract tests passed` and `ChampionMoment 375px layout regression passed`.

- [ ] **Step 2: Run the production build and whitespace validation**

Run:

```bash
npm run build
git diff --check
```

Expected: Vite exits 0 and reports a successful build; `git diff --check` produces no output.

- [ ] **Step 3: Review scope and fallback preservation**

Run:

```bash
git diff HEAD~2 -- src/index.css src/views/ChampionMoment.test.ts
git status --short
```

Expected: production changes are limited to the champion CSS treatment; tests contain only the new visual contract; `ChampionMoment.tsx` and data modules remain unchanged. The local `.superpowers/` visual-companion directory may remain untracked and must not be staged.

- [ ] **Step 4: Record the verified state**

If verification produces no implementation changes, do not create an empty commit. Report the two implementation commits and the successful test/build evidence for deployment handoff.
