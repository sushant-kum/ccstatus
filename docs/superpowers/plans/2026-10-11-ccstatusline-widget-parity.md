# ccstatusline Widget Parity (Tier A + B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 ccstatusline-parity widgets to ccstatus (plus the snapshot fields and mod gathering they need) and rewrite the ccstatusline importer so it maps every supported widget instead of dropping it.

**Architecture:** Widgets are `register({ type, label, format })` in `@ccstatus/core`; the TUI picker auto-lists the `registry`, so no TUI change exposes them. New data comes from new `Snapshot` fields the mod's `register.tsx` gathers (`$.session`, the git shell probe, a `prompt.compose` hook) and `snapshot-build.ts` assembles. The importer maps ccstatusline `type` ids to ccstatus widgets.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, NodeNext), zod (core), vitest, tsup (bundle), the Claude Code mod engine.

**Spec:** `docs/superpowers/specs/2026-10-11-ccstatusline-widget-parity-design.md`

## Global Constraints

- TS strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, NodeNext; **all local imports use `.js` extensions**.
- Every function/widget needs JSDoc (TS-mode, no `{type}` tags) and an explicit return type; `any` and non-null `!` are lint errors.
- **`WIDGET_TYPES`** (`packages/core/src/config/types.ts`) is the single source of truth — add each new type there; `DataWidgetType` excludes only `custom-text`/`custom-command`/`flex-separator`, so every new type is a data widget automatically.
- A widget is `register({ type, label, format: ({ snapshot, item }) => string | null })`; `null` omits the item. Helpers in `core`: `fmtNum(n)`, `fmtDur(ms)`, `pct(x)`, `bar(x, width=5)`. In `data-widgets.ts`: `labeled(raw, label, value)` and `rawOf(item)`.
- After ANY change under `packages/core/src/`, run `npm run build:plugin-core` and commit the regenerated `plugin/hooks/core.{js,d.ts}` (CI drift check); they are excluded from Prettier/ESLint/cspell.
- The plugin uses **static imports only**; pure modules import only `./core.js`.
- Conventional Commits (commit-msg hook); no AI-attribution. Workspace commands: `npm test -w @ccstatus/core`, `npm run test:plugin-pure`, `npm run typecheck -w @ccstatus/core`.
- Engine-integration plugin tests (`register`/`band`) run only under the preview `claude` build, never here — `register.tsx` changes are verified by `node scripts/check-plugin.mjs` + reading, not execution.

## Review Focus

- **`session-cost-rate` with elapsed < 1 min or `cost === null`** → returns `null`, never `NaN`/`Infinity`/`$0.00/hr` (Task 5 test).
- **`reset-timer`/`weekly-reset-timer` with an absent or past reset time** → `null`, not a negative/zero duration (Task 1 test).
- **`git-sha`/`git-insertions`/`git-deletions` outside a repo** (`repo === false`) → `null` (Tasks 2 & 5 tests).
- **`parseGit` on output without the new SHA column** (old snapshot / no-repo) → `sha === ''`, no crash (Task 3 test).
- **Importer: a `custom-text`/`custom-command` item** carries its `customText`/`commandPath`, and an **unsupported type** is dropped with its _specific_ reason (not the generic message) (Task 6 tests).

---

### Task 1: Tier A usage/timer split widgets

**Files:**

- Modify: `packages/core/src/config/types.ts` (add 4 to `WIDGET_TYPES`)
- Modify: `packages/core/src/widgets/usage-widgets.ts` (export `until`; add 4 widgets)
- Test: `packages/core/src/widgets/usage-widgets.test.ts` (new or extend)
- Regenerate: `plugin/hooks/core.{js,d.ts}`

**Interfaces:**

- Produces: widget types `session-usage`, `weekly-usage`, `reset-timer`, `weekly-reset-timer`; and an **exported** `until(iso: string | null, now: number): number | null` (currently module-private — export it, do not duplicate).

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/widgets/usage-widgets.test.ts
import { describe, expect, it } from 'vitest';

import { registry } from './registry.js';
import './usage-widgets.js';
import { sampleSnapshot } from '../../../tui/src/sample-snapshot.js';

// If importing the tui sample is awkward, build a minimal snapshot inline instead.
const snap = (over: Partial<typeof sampleSnapshot>): typeof sampleSnapshot => ({
  ...sampleSnapshot,
  ...over,
});
const fmt = (type: string, s: object): string | null =>
  registry[type as keyof typeof registry]!.format({
    snapshot: s as never,
    item: { id: 'x', type } as never,
  });

describe('tier-A usage widgets', () => {
  it('session-usage shows the 5h percentage, or null when unknown', () => {
    expect(fmt('session-usage', snap({ fivePct: 42 }))).toBe('Session: 42%');
    expect(fmt('session-usage', snap({ fivePct: null }))).toBeNull();
  });
  it('weekly-usage shows the weekly percentage', () => {
    expect(fmt('weekly-usage', snap({ weekPct: 10 }))).toBe('Weekly: 10%');
    expect(fmt('weekly-usage', snap({ weekPct: null }))).toBeNull();
  });
  it('reset-timer shows the 5h reset countdown, null when absent/past', () => {
    expect(fmt('reset-timer', snap({ fiveReset: null, now: 1000 }))).toBeNull();
    const future = new Date(1000 + 3_600_000).toISOString();
    expect(fmt('reset-timer', snap({ fiveReset: future, now: 1000 }))).toMatch(/^Reset: /);
    const past = new Date(1000 - 10).toISOString();
    expect(fmt('reset-timer', snap({ fiveReset: past, now: 1000 }))).toBeNull();
  });
  it('weekly-reset-timer shows the weekly reset countdown', () => {
    const future = new Date(1000 + 86_400_000).toISOString();
    expect(fmt('weekly-reset-timer', snap({ weekReset: future, now: 1000 }))).toMatch(
      /^Weekly Reset: /
    );
    expect(fmt('weekly-reset-timer', snap({ weekReset: null, now: 1000 }))).toBeNull();
  });
});
```

(Note: `pct(42)` returns `"42%"` and `fmtDur` a compact duration — assert the prefix/shape, not exact duration text. If `pct` formats differently, align the expected strings to `pct`'s real output after Step 2.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ccstatus/core -- usage-widgets`
Expected: FAIL — the four widget types are not registered.

- [ ] **Step 3: Add the widget types**

In `packages/core/src/config/types.ts`, add to `WIDGET_TYPES` after `'block-timer',`:

```ts
  'session-usage',
  'weekly-usage',
  'reset-timer',
  'weekly-reset-timer',
```

- [ ] **Step 4: Export `until` and add the widgets**

In `packages/core/src/widgets/usage-widgets.ts`, change `function until(` to `export function until(` (keep its JSDoc), then append:

```ts
register({
  type: 'session-usage',
  label: 'Session %',
  format: ({ snapshot }) =>
    snapshot.fivePct === null ? null : `Session: ${pct(snapshot.fivePct)}`,
});
register({
  type: 'weekly-usage',
  label: 'Weekly %',
  format: ({ snapshot }) => (snapshot.weekPct === null ? null : `Weekly: ${pct(snapshot.weekPct)}`),
});
register({
  type: 'reset-timer',
  label: 'Reset',
  format: ({ snapshot }) => {
    const r = until(snapshot.fiveReset, snapshot.now);
    return r === null ? null : `Reset: ${fmtDur(r)}`;
  },
});
register({
  type: 'weekly-reset-timer',
  label: 'Weekly Reset',
  format: ({ snapshot }) => {
    const r = until(snapshot.weekReset, snapshot.now);
    return r === null ? null : `Weekly Reset: ${fmtDur(r)}`;
  },
});
```

`pct` is already imported in this file; confirm `fmtDur` is too (it is).

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -w @ccstatus/core -- usage-widgets` and `npm run typecheck -w @ccstatus/core`
Expected: PASS.

- [ ] **Step 6: Regenerate the bundle and commit**

```bash
npm run build:plugin-core
git add packages/core/src/config/types.ts packages/core/src/widgets/usage-widgets.ts packages/core/src/widgets/usage-widgets.test.ts plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): add session/weekly usage and reset-timer widgets"
```

---

### Task 2: Tier A context / effort / git widgets

**Files:**

- Modify: `packages/core/src/config/types.ts` (add 5 to `WIDGET_TYPES`)
- Modify: `packages/core/src/widgets/data-widgets.ts` (add `context-bar`, `context-remaining`, `thinking-effort`)
- Modify: `packages/core/src/widgets/git-widgets.ts` (add `git-insertions`, `git-deletions`)
- Test: `packages/core/src/widgets/all-widgets.test.ts` (extend) or new per-file tests
- Regenerate: `plugin/hooks/core.{js,d.ts}`

**Interfaces:**

- Consumes: `labeled`/`rawOf` (module-private in `data-widgets.ts`), `bar`/`pct` from `../format.js`.
- Produces: widget types `context-bar`, `context-remaining`, `thinking-effort`, `git-insertions`, `git-deletions`.

- [ ] **Step 1: Write the failing test**

```ts
// append to packages/core/src/widgets/data-widgets.test.ts (or a new file importing the widgets)
import { registry } from './registry.js';
import './data-widgets.js';
import './git-widgets.js';
import { sampleSnapshot } from '../../../tui/src/sample-snapshot.js';

const f = (type: string, s: object): string | null =>
  registry[type as keyof typeof registry]!.format({
    snapshot: { ...sampleSnapshot, ...s } as never,
    item: { id: 'x', type } as never,
  });

describe('tier-A context/effort/git widgets', () => {
  it('context-remaining is 100 - ctxPct', () => {
    expect(f('context-remaining', { ctxPct: 21 })).toBe('Ctx Left: 79%');
  });
  it('context-bar renders a bar', () => {
    expect(typeof f('context-bar', { ctxPct: 50 })).toBe('string');
  });
  it('thinking-effort shows effort or null', () => {
    expect(f('thinking-effort', { effort: 'high' })).toBe('Effort: high');
    expect(f('thinking-effort', { effort: null })).toBeNull();
  });
  it('git-insertions/deletions show +/- counts in a repo, null otherwise', () => {
    expect(f('git-insertions', { repo: true, added: 3 })).toBe('+3');
    expect(f('git-deletions', { repo: true, deleted: 2 })).toBe('-2');
    expect(f('git-insertions', { repo: false })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ccstatus/core -- data-widgets`
Expected: FAIL — types not registered.

- [ ] **Step 3: Add the widget types**

In `WIDGET_TYPES`, add after the Task 1 additions:

```ts
  'context-bar',
  'context-remaining',
  'thinking-effort',
  'git-insertions',
  'git-deletions',
```

- [ ] **Step 4: Implement**

In `packages/core/src/widgets/data-widgets.ts`, add `bar` to the format import (`import { bar, fmtDur, fmtNum, pct } from '../format.js';`) and append:

```ts
register({
  type: 'context-bar',
  label: 'Ctx Bar',
  format: ({ snapshot }) => bar(snapshot.ctxPct),
});
register({
  type: 'context-remaining',
  label: 'Ctx Left',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Ctx Left', pct(100 - snapshot.ctxPct)),
});
register({
  type: 'thinking-effort',
  label: 'Effort',
  format: ({ snapshot, item }) =>
    snapshot.effort ? labeled(rawOf(item), 'Effort', snapshot.effort) : null,
});
```

In `packages/core/src/widgets/git-widgets.ts`, append:

```ts
register({
  type: 'git-insertions',
  label: 'Insertions',
  format: ({ snapshot }) => (snapshot.repo ? `+${snapshot.added}` : null),
});
register({
  type: 'git-deletions',
  label: 'Deletions',
  format: ({ snapshot }) => (snapshot.repo ? `-${snapshot.deleted}` : null),
});
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -w @ccstatus/core` and `npm run typecheck -w @ccstatus/core`
Expected: PASS.

- [ ] **Step 6: Regenerate the bundle and commit**

```bash
npm run build:plugin-core
git add packages/core/src plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): add context-bar/remaining, thinking-effort, git-insertions/deletions widgets"
```

---

### Task 3: New snapshot fields + cost/ctxWindow wiring (pure plumbing)

**Files:**

- Modify: `packages/core/src/snapshot.ts` (4 new fields)
- Modify: `packages/tui/src/sample-snapshot.ts` (sample values)
- Modify: `packages/tui/src/snapshot-source.ts` (sanitize field lists)
- Modify: `plugin/types/index.d.ts` (`CcstatusSnapshot` mirror)
- Modify: `plugin/hooks/git-parse.ts` (`GitFields.sha` + parse)
- Modify: `plugin/hooks/snapshot-build.ts` (`RawUsage.cost`/`ctxWindow`; buildSnapshot sets new fields)
- Test: `packages/tui/src/snapshot-source.test.ts`, `plugin/hooks/git-parse.test.ts`, `plugin/hooks/snapshot-build.test.ts`
- Regenerate: `plugin/hooks/core.{js,d.ts}`

**Interfaces:**

- Produces: `Snapshot` gains `sessionId: string`, `ctxWindow: number`, `gitSha: string`, `outputStyle: string | null`. `GitFields` gains `sha: string`. `RawUsage` gains `cost: number | null` and `ctxWindow: number`. `buildSnapshot`'s `raw` arg gains `sessionId: string`, `outputStyle: string | null`, `terminalWidth: number` (git sha comes via `raw.git.sha`).

- [ ] **Step 1: Write failing tests**

```ts
// plugin/hooks/git-parse.test.ts — add:
it('parses the sha column and tolerates its absence', () => {
  expect(parseGit('YES\troot\tmain\t\t1\t2\t0\tabc1234').sha).toBe('abc1234');
  expect(parseGit('YES\troot\tmain\t\t1\t2\t0').sha).toBe(''); // old output, no column
  expect(parseGit('NO').sha).toBe('');
});
```

```ts
// plugin/hooks/snapshot-build.test.ts — add:
it('carries sessionId, ctxWindow, gitSha, outputStyle, cost, terminalWidth', () => {
  const s = buildSnapshot({
    version: '1',
    model: 'm',
    effort: null,
    cwd: '/x',
    now: 0,
    sessionId: 'sess-123',
    outputStyle: 'concise',
    terminalWidth: 120,
    git: {
      repo: true,
      root: 'r',
      branch: 'b',
      worktree: '',
      added: 0,
      modified: 0,
      deleted: 0,
      sha: 'abc1234',
    },
    usage: {
      ctxTokens: 1,
      ctxPct: 2,
      cached: 0,
      input: 0,
      output: 0,
      startedAt: 0,
      fivePct: null,
      fiveReset: null,
      weekPct: null,
      weekReset: null,
      cost: 0.5,
      ctxWindow: 200000,
    },
  });
  expect(s.sessionId).toBe('sess-123');
  expect(s.gitSha).toBe('abc1234');
  expect(s.outputStyle).toBe('concise');
  expect(s.cost).toBe(0.5);
  expect(s.ctxWindow).toBe(200000);
  expect(s.terminalWidth).toBe(120);
});
```

```ts
// packages/tui/src/snapshot-source.test.ts — add:
it('keeps the new fields and drops wrong-typed ones', () => {
  const { snapshot } = readSnapshotFrom({
    sessionId: 'x',
    gitSha: 'y',
    outputStyle: 'z',
    ctxWindow: 5,
  });
  // use the test's existing helper for feeding a parsed object; assert the four fields survive.
});
```

(Use whatever seam `snapshot-source.test.ts` already uses to feed a parsed object; the point is the four fields pass `sanitize`.)

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:plugin-pure` and `npm test -w @ccstatus/core` (the tui test runs under the tui suite: `npm test -w @sushant-kum/ccstatus -- snapshot-source`)
Expected: FAIL — fields/`sha` missing.

- [ ] **Step 3: Add the Snapshot fields (core)**

In `packages/core/src/snapshot.ts`, add inside the interface (e.g. after `now`):

```ts
sessionId: string;
ctxWindow: number;
gitSha: string;
outputStyle: string | null;
```

- [ ] **Step 4: Update the pure consumers**

`packages/tui/src/sample-snapshot.ts` — add realistic values and populate the previously-dead ones:

```ts
  sessionId: 'sess-abc1234',
  ctxWindow: 200000,
  gitSha: 'a1b2c3d',
  outputStyle: null,
```

and change `cost: null` → `cost: 0.42`, `terminalWidth: 0` → `terminalWidth: 120`.

`packages/tui/src/snapshot-source.ts` — in `sanitize`: add `'sessionId'`, `'gitSha'` to `STRING_FIELDS`; `'outputStyle'` to `NULLABLE_STRING_FIELDS`; `'ctxWindow'` to `NUMBER_FIELDS`.

`plugin/types/index.d.ts` — add to `CcstatusSnapshot` the same four fields (`sessionId: string; ctxWindow: number; gitSha: string; outputStyle: string | null;`).

`plugin/hooks/git-parse.ts` — add `sha: string;` to `GitFields` and `none`; in `parseGit` return add `sha: t[7] ?? '',`.

`plugin/hooks/snapshot-build.ts`:

- `RawUsage`: add `cost: number | null;` and `ctxWindow: number;`. `emptyUsage`: add `cost: null,` and `ctxWindow: 0,`.
- `buildSnapshot`'s `raw` parameter type: add `sessionId: string; outputStyle: string | null; terminalWidth: number;`.
- In the returned object: `cost: u.cost,` (replace `cost: null`), `terminalWidth: raw.terminalWidth,` (replace `terminalWidth: 0`), and add `sessionId: raw.sessionId, ctxWindow: u.ctxWindow, gitSha: raw.git.sha, outputStyle: raw.outputStyle,`.

- [ ] **Step 5: Run tests + typecheck (core + pure + tui)**

Run: `npm test -w @ccstatus/core`, `npm run test:plugin-pure`, `npm test -w @sushant-kum/ccstatus -- snapshot-source`, `npm run typecheck -w @ccstatus/core`
Expected: PASS. (The `register.tsx` `buildSnapshot(...)` call now misses the new `raw` fields — that is fixed in Task 4; until then `tsc -p plugin` will error, which is acceptable as the plugin isn't typechecked in CI. If a pure test imports a path that fails to compile, scope the tests to the pure modules only.)

- [ ] **Step 6: Regenerate the bundle and commit**

```bash
npm run build:plugin-core
git add packages/core/src/snapshot.ts packages/tui/src/sample-snapshot.ts packages/tui/src/snapshot-source.ts packages/tui/src/snapshot-source.test.ts plugin/types/index.d.ts plugin/hooks/git-parse.ts plugin/hooks/git-parse.test.ts plugin/hooks/snapshot-build.ts plugin/hooks/snapshot-build.test.ts plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): add sessionId/ctxWindow/gitSha/outputStyle snapshot fields; wire cost + terminalWidth"
```

---

### Task 4: Mod gathering (register.tsx + git probe)

**Files:**

- Modify: `plugin/hooks/register.tsx` (GIT probe column; `measure` fields; `prompt.compose` hook; terminal-width capture)

**Interfaces:**

- Consumes: `GitFields.sha`, `RawUsage.cost`/`ctxWindow`, and `buildSnapshot`'s new `raw` fields (Task 3).
- Produces: a snapshot whose `sessionId`, `gitSha`, `cost`, `ctxWindow`, `outputStyle`, `terminalWidth` are populated from the engine.

**This file is engine-coupled — it cannot be executed here.** Verify by reading, `node scripts/check-plugin.mjs`, `npm run test:plugin-pure` (unaffected), and `npx eslint plugin`. Before wiring, confirm the exact field names against the live engine types (`$.session.usage()` returns `{ startedAt, context, rateLimits, cost }`; the context carries a window-size field such as `maxTokens`; the `prompt.compose` input carries `outputStyle: { name } | null`). If `outputStyle` or the context window size is genuinely unavailable on this build, set that field to its default (`null` / `0`) and note it — the corresponding widget then renders nothing (graceful).

- [ ] **Step 1: Extend the git probe**

In the `GIT` shell constant, before the final `printf`, add `h=$(git rev-parse --short HEAD 2>/dev/null);`, and append a column to the printf format and args: `...\\t%s" ... "$h"`. (The YES branch now prints 8 tab-separated fields; `parseGit` already reads `t[7]`.)

- [ ] **Step 2: Capture cost + context window in usage extraction**

In `extractContextUsage`, add `ctxWindow` from the usage context's window-size field (e.g. `b?.maxTokens ?? context?.maxTokens ?? 0` — use the real field after confirming the type) to its returned object, and widen its `Pick<...>` return type to include `'ctxWindow'`. In `extractUsage`, add `cost: usageRaw?.cost ?? null,` to the returned `RawUsage`.

- [ ] **Step 3: Add atoms + the output-style hook + width capture**

Add atoms near the others: `const outputStyle = atom({ plugin: 'ccstatus', key: 'outputStyle' } as const, null);` and `const termWidth = atom({ plugin: 'ccstatus', key: 'termWidth' } as const, 0);` (declare both in `plugin/types/index.d.ts`'s `PluginState.ccstatus` as `outputStyle: string | null` and `termWidth: number`).

Add a hook that captures the output style (mirroring `captureEffort`):

```tsx
on('prompt.compose', async ($, e, next) => {
  const r = await next(e);
  const name = (e as { outputStyle?: { name?: unknown } | null }).outputStyle?.name;
  if (typeof name === 'string') {
    await update($, outputStyle, () => name).catch(() => undefined);
  }
  return r;
});
```

In the `AbovePrompt` `ui.render` hook, after reading `width`, store it: `void update($, termWidth, () => width);` (best-effort; it feeds `terminal-width` and keeps the snapshot width honest).

- [ ] **Step 4: Pass the new fields through `measure`**

In `measure`, add to the `Promise.all` an `$.session.id().catch(() => '')`, and read `outputStyle`/`termWidth` atoms; pass `sessionId`, `outputStyle`, and `terminalWidth` into the `buildSnapshot({ ... })` call (alongside the existing `version, model, effort, cwd, now, git, usage`).

- [ ] **Step 5: Verify**

Run: `npx --no -- eslint plugin --no-error-on-unmatched-pattern` (clean), `npm run test:plugin-pure` (pass), `node scripts/check-plugin.mjs` (OK), `npm run build:plugin-core` then `git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts` (no drift — this task doesn't change core).
Expected: all green. (`tsc -p plugin` now compiles the `buildSnapshot` call correctly; engine-type gaps for `claude-code` remain and are pre-existing.)

- [ ] **Step 6: Commit**

```bash
git add plugin/hooks/register.tsx plugin/types/index.d.ts
git commit -m "feat(plugin): gather sessionId, cost, ctxWindow, git sha, output-style, terminal width"
```

---

### Task 5: Tier B widgets

**Files:**

- Modify: `packages/core/src/config/types.ts` (add 6 to `WIDGET_TYPES`)
- Modify: `packages/core/src/widgets/data-widgets.ts` (`session-id`, `context-window`, `output-style`, `terminal-width`)
- Modify: `packages/core/src/widgets/git-widgets.ts` (`git-sha`)
- Modify: `packages/core/src/widgets/usage-widgets.ts` (`session-cost-rate`)
- Test: the widget test files
- Regenerate: `plugin/hooks/core.{js,d.ts}`

**Interfaces:**

- Consumes: `Snapshot.{sessionId,ctxWindow,gitSha,outputStyle,cost,startedAt,now,terminalWidth,repo}` (Task 3).
- Produces: widget types `session-id`, `context-window`, `session-cost-rate`, `git-sha`, `output-style`, `terminal-width`.

- [ ] **Step 1: Write failing tests**

```ts
// in the data-widgets / usage-widgets tests:
it('session-id shows first 8 chars (full when raw), null when empty', () => {
  expect(f('session-id', { sessionId: 'abcdef1234567' })).toBe('abcdef12');
  expect(f('session-id', { sessionId: '' })).toBeNull();
});
it('context-window shows the window size, null when 0', () => {
  expect(f('context-window', { ctxWindow: 200000 })).toBe('Window: 200k');
  expect(f('context-window', { ctxWindow: 0 })).toBeNull();
});
it('git-sha shows the sha in a repo, null otherwise', () => {
  expect(f('git-sha', { repo: true, gitSha: 'a1b2c3d' })).toBe('a1b2c3d');
  expect(f('git-sha', { repo: false, gitSha: 'a1b2c3d' })).toBeNull();
});
it('output-style shows the style, null when none', () => {
  expect(f('output-style', { outputStyle: 'concise' })).toBe('Style: concise');
  expect(f('output-style', { outputStyle: null })).toBeNull();
});
it('terminal-width shows width when known', () => {
  expect(f('terminal-width', { terminalWidth: 120 })).toBe('Width: 120');
  expect(f('terminal-width', { terminalWidth: 0 })).toBeNull();
});
it('session-cost-rate: null when cost null or elapsed < 1min, else $/hr', () => {
  expect(f('session-cost-rate', { cost: null })).toBeNull();
  expect(f('session-cost-rate', { cost: 1, startedAt: 0, now: 30_000 })).toBeNull(); // < 1 min
  expect(f('session-cost-rate', { cost: 1, startedAt: 0, now: 3_600_000 })).toBe('$1.00/hr');
});
```

(Confirm `fmtNum(200000)` output — adjust `"Window: 200k"` to its real formatting after Step 2.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @ccstatus/core`
Expected: FAIL — types not registered.

- [ ] **Step 3: Add the widget types**

In `WIDGET_TYPES`, add after the Task 2 additions:

```ts
  'session-id',
  'context-window',
  'session-cost-rate',
  'git-sha',
  'output-style',
  'terminal-width',
```

- [ ] **Step 4: Implement**

`data-widgets.ts` append:

```ts
register({
  type: 'session-id',
  label: 'Session ID',
  format: ({ snapshot, item }) =>
    snapshot.sessionId ? (rawOf(item) ? snapshot.sessionId : snapshot.sessionId.slice(0, 8)) : null,
});
register({
  type: 'context-window',
  label: 'Ctx Window',
  format: ({ snapshot, item }) =>
    snapshot.ctxWindow > 0 ? labeled(rawOf(item), 'Window', fmtNum(snapshot.ctxWindow)) : null,
});
register({
  type: 'output-style',
  label: 'Style',
  format: ({ snapshot, item }) =>
    snapshot.outputStyle ? labeled(rawOf(item), 'Style', snapshot.outputStyle) : null,
});
register({
  type: 'terminal-width',
  label: 'Width',
  format: ({ snapshot, item }) =>
    snapshot.terminalWidth > 0
      ? labeled(rawOf(item), 'Width', String(snapshot.terminalWidth))
      : null,
});
```

`git-widgets.ts` append:

```ts
register({
  type: 'git-sha',
  label: 'SHA',
  format: ({ snapshot }) => (snapshot.repo && snapshot.gitSha ? snapshot.gitSha : null),
});
```

`usage-widgets.ts` append:

```ts
register({
  type: 'session-cost-rate',
  label: 'Cost/hr',
  format: ({ snapshot }) => {
    if (snapshot.cost === null) {
      return null;
    }
    const ms = snapshot.now - snapshot.startedAt;
    if (ms < 60_000) {
      return null;
    }
    return `$${(snapshot.cost / (ms / 3_600_000)).toFixed(2)}/hr`;
  },
});
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -w @ccstatus/core` and `npm run typecheck -w @ccstatus/core`
Expected: PASS.

- [ ] **Step 6: Regenerate the bundle and commit**

```bash
npm run build:plugin-core
git add packages/core/src plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): add session-id, context-window, session-cost-rate, git-sha, output-style, terminal-width widgets"
```

---

### Task 6: ccstatusline importer rewrite

**Files:**

- Modify: `packages/core/src/config/import-ccstatusline.ts`
- Test: `packages/core/src/config/import-ccstatusline.test.ts`
- Regenerate: `plugin/hooks/core.{js,d.ts}` (core changed)

**Interfaces:**

- Consumes: all widget types from Tasks 1/2/5.
- Produces: an importer that maps every supported ccstatusline `type`, handles `custom-text`/`custom-command`, and drops unsupported types with a specific reason.

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/src/config/import-ccstatusline.test.ts — add:
it('maps the previously-dropped usage widgets', () => {
  const { config } = importCcstatusline({
    lines: [
      [
        { type: 'session-usage' },
        { type: 'reset-timer' },
        { type: 'weekly-usage' },
        { type: 'weekly-reset-timer' },
      ],
    ],
  });
  const types = config.surfaces.band.lines[0]?.map((i) => i.type);
  expect(types).toEqual(['session-usage', 'reset-timer', 'weekly-usage', 'weekly-reset-timer']);
});
it('maps aliases and custom items with their payload', () => {
  const { config } = importCcstatusline({
    lines: [
      [
        { type: 'current-working-dir' },
        { type: 'session-cost' },
        { type: 'custom-text', customText: 'hi' },
        { type: 'custom-command', commandPath: 'echo x' },
      ],
    ],
  });
  const items = config.surfaces.band.lines[0]!;
  expect(items[0]!.type).toBe('cwd');
  expect(items[1]!.type).toBe('cost');
  expect(items[2]).toMatchObject({ type: 'custom-text', text: 'hi' });
  expect(items[3]).toMatchObject({ type: 'custom-command', command: 'echo x' });
});
it('drops an unsupported widget with a specific reason', () => {
  const { warnings } = importCcstatusline({ lines: [[{ type: 'weekly-opus-usage' }]] });
  expect(
    warnings.some((w) => w.includes('weekly-opus-usage') && /Anthropic usage API/i.test(w))
  ).toBe(true);
});
it('drops a separator with its note', () => {
  const { warnings } = importCcstatusline({ lines: [[{ type: 'separator' }]] });
  expect(warnings.some((w) => /separator/i.test(w) && /global/i.test(w))).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w @ccstatus/core -- import-ccstatusline`
Expected: FAIL.

- [ ] **Step 3: Rewrite the importer**

Replace `TYPE_MAP` with the full data-widget map and add an `UNSUPPORTED` reason map and custom-item handling. The data map (ccstatusline → ccstatus `DataWidgetType`):

```ts
const TYPE_MAP: Record<string, DataWidgetType> = {
  model: 'model',
  version: 'version',
  'thinking-effort': 'thinking-effort',
  'context-length': 'context-length',
  'context-percentage': 'context-percentage',
  'context-window': 'context-window',
  'context-bar': 'context-bar',
  'tokens-input': 'tokens-input',
  'tokens-output': 'tokens-output',
  'tokens-cached': 'tokens-cached',
  'tokens-total': 'tokens-total',
  'git-root-dir': 'git-root-dir',
  'git-branch': 'git-branch',
  'git-worktree': 'git-worktree',
  'git-changes': 'git-changes',
  'git-insertions': 'git-insertions',
  'git-deletions': 'git-deletions',
  'git-sha': 'git-sha',
  'session-clock': 'session-clock',
  'session-id': 'session-id',
  'current-working-dir': 'cwd',
  cwd: 'cwd',
  'session-cost': 'cost',
  cost: 'cost',
  'session-cost-rate': 'session-cost-rate',
  'session-usage': 'session-usage',
  'weekly-usage': 'weekly-usage',
  'reset-timer': 'reset-timer',
  'weekly-reset-timer': 'weekly-reset-timer',
  'block-timer': 'block-timer',
  'terminal-width': 'terminal-width',
  'output-style': 'output-style',
};

// Unsupported in the mod's data model — dropped with a specific reason. See DEC-0015.
const UNSUPPORTED: Record<string, string> = {
  'weekly-sonnet-usage': 'the Anthropic usage API',
  'weekly-opus-usage': 'the Anthropic usage API',
  'fable-weekly-usage': 'the Anthropic usage API',
  'extra-usage-utilization': 'the Anthropic usage API',
  'extra-usage-remaining': 'the Anthropic usage API',
  'extra-usage-used': 'the Anthropic usage API',
  'extra-usage-daily-budget': 'the Anthropic usage API',
  'input-speed': 'transcript parsing',
  'output-speed': 'transcript parsing',
  'total-speed': 'transcript parsing',
  'cache-hit-rate': 'transcript parsing',
  'cache-read': 'transcript parsing',
  'cache-write': 'transcript parsing',
  'compaction-counter': 'transcript parsing',
  skills: 'transcript parsing',
  'session-name': 'transcript parsing',
  'cache-timer': 'cache-TTL tracking not available to the mod',
  'free-memory': 'OS access not available to the mod',
  'claude-status': 'a network status fetch',
  'claude-account-email': 'local Claude config access',
  'claude-session-id': 'use session-id',
  'vim-mode': 'engine state not exposed to the mod',
  'voice-status': 'engine state not exposed to the mod',
  'sandbox-status': 'engine state not exposed to the mod',
  'remote-control-status': 'engine state not exposed to the mod',
  'worktree-mode': "Claude Code's worktree object (use git-worktree)",
  'worktree-name': "Claude Code's worktree object (use git-worktree)",
  'worktree-branch': "Claude Code's worktree object (use git-worktree)",
  'worktree-original-branch': "Claude Code's worktree object (use git-worktree)",
  'context-percentage-usable': 'usable-window data not available to the mod',
  'context-window-size': 'use context-window',
  'git-staged-files': 'a deeper git probe',
  'git-unstaged-files': 'a deeper git probe',
  'git-untracked-files': 'a deeper git probe',
  'git-clean-status': 'a deeper git probe',
  'git-status': 'a deeper git probe',
  'git-staged': 'a deeper git probe',
  'git-unstaged': 'a deeper git probe',
  'git-untracked': 'a deeper git probe',
  'git-ahead-behind': 'a deeper git probe',
  'git-conflicts': 'a deeper git probe',
  'git-origin-owner': 'a deeper git probe',
  'git-origin-repo': 'a deeper git probe',
  'git-origin-owner-repo': 'a deeper git probe',
  'git-upstream-owner': 'a deeper git probe',
  'git-upstream-repo': 'a deeper git probe',
  'git-upstream-owner-repo': 'a deeper git probe',
  'git-is-fork': 'a deeper git probe',
  'git-review': 'the gh/glab CLI',
  'git-ci-status': 'the gh/glab CLI',
  link: 'OSC8 links not yet supported',
};
```

In the item mapper, after reading `srcType`:

1. `custom-text` → `{ id, type: 'custom-text', text: String(raw['customText'] ?? ''), ...style }`.
2. `custom-command` → `{ id, type: 'custom-command', command: String(raw['commandPath'] ?? ''), ...style }`.
3. `custom-symbol` → a `custom-text` with `text: String(raw['customSymbol'] ?? '')`.
4. `flex-separator` → `{ id, type: 'flex-separator' }`.
5. `separator` → drop: `warnings.push('dropped "separator" — ccstatus uses a global separator (set it on the Powerline screen)')`.
6. a `TYPE_MAP` hit → the existing `DataItem` mapping (`bg`, `rawValue`, `merge`).
7. an `UNSUPPORTED` hit → `warnings.push(\`dropped "${srcType}" — needs ${UNSUPPORTED[srcType]}, not available to the mod\`)`.
8. otherwise the existing generic `dropped unmapped ccstatusline item "${srcType}"`.

The `id`/`bg`/`rawValue`/`merge` extraction is shared — factor a small helper so custom and data items reuse it (DRY). Any `jj-*` type falls through to the generic drop (acceptable) unless added to `UNSUPPORTED`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -w @ccstatus/core -- import-ccstatusline` and `npm run typecheck -w @ccstatus/core`
Expected: PASS.

- [ ] **Step 5: Regenerate the bundle and commit**

```bash
npm run build:plugin-core
git add packages/core/src/config/import-ccstatusline.ts packages/core/src/config/import-ccstatusline.test.ts plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): map all supported ccstatusline widgets on import, with reasons for the rest"
```

---

### Task 7: Documentation (DEC-0015 + CLAUDE.md)

**Files:**

- Modify: `docs/DECISION.md` (new `DEC-0015` + index row)
- Modify: `CLAUDE.md` (widget-count / parity note)
- Modify: `cspell.json` if any new domain term trips cspell

**Interfaces:** none (docs).

- [ ] **Step 1: Add `DEC-0015`**

Append `DEC-0015 — ccstatusline widget parity: ported set and deferred set` (follow the DEC template + add the index row dated 2026-10-11). Record: the Tier A+B widgets added; that `worktree-*` and the Tier C groups (Anthropic usage API, transcript, deeper git, jj, OS/network, engine-state widgets) are **deferred** because the mod can't source their data; that `cost`/`terminalWidth` were previously dormant and are now wired; and that the importer drops unsupported types with specific reasons. Link the spec.

- [ ] **Step 2: Update CLAUDE.md**

In the conventions/architecture notes, update any widget-count reference and add a one-liner: new widgets are a `register(...)` in `core` (auto-listed by the TUI picker); unsupported ccstatusline widgets are enumerated with reasons in `import-ccstatusline.ts` (see DEC-0015).

- [ ] **Step 3: Verify + commit**

Run: `npm run format:check`, `npm run cspell` (add any new words to `cspell.json`), `npm run knip`.

```bash
git add docs/DECISION.md CLAUDE.md cspell.json
git commit -m "docs: record ccstatusline widget parity (DEC-0015)"
```

---

## Final verification (before the PR)

- [ ] `npm run lint:error`, `npm run format:check`, `npm run cspell`, `npm run knip` → all clean
- [ ] `npm test -w @ccstatus/core` and `npm test -w @sushant-kum/ccstatus` → pass
- [ ] `npm run test:plugin-pure` and `node scripts/check-plugin.mjs` → pass
- [ ] `npm run build:plugin-core` → `git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts` clean (bundle committed)
- [ ] New widgets appear in the TUI picker (they come from `registry`); importer maps the previously-dropped `session-usage`/`weekly-usage`/`reset-timer`/`weekly-reset-timer`
- [ ] Manual (author, preview engine): band/pane show the new widgets with live data; `output-style`/`ctxWindow`/`gitSha`/`sessionId`/`cost` populate (or degrade gracefully if a source is unavailable)
