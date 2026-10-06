# ccstatus Plan 3 — TUI configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Ink screens are judgment tasks (standard model), not transcription.

**Goal:** Build `packages/tui` — the `npx ccstatus` interactive Ink configurator — plus the two small supporting changes it needs (a configurable powerline glyph in core; the mod persisting its latest snapshot to disk). The TUI edits the shared config with a live band preview pinned on every screen, exactly as approved in the mockup.

**Architecture:** A React/Ink app (normal Node, bundles `@ccstatus/core` at build) with a root `App` that owns the loaded `Config`, routes between screens, and renders a pinned `Preview` on every screen. The preview runs the real `core.render` over the mod's last on-disk snapshot when present, else sample data — so what you see matches the mod. Config saves are atomic with a backup.

**Tech Stack:** TypeScript (ESM), React + Ink (terminal UI), ink-testing-library (tests), tsup (bundles the `ccstatus` bin), `@ccstatus/core`. Node ≥ 20.

**Spec:** `docs/superpowers/specs/2026-10-04-ccstatus-design.md`
**Approved design:** the TUI mockup reviewed this session — 8 screens (Menu, Edit items, Themes, Powerline, Surfaces, Defaults, Preview, Import), pinned live band preview on every screen.
**Builds on:** `@ccstatus/core` (Plan 1) and the `ccstatus` plugin (Plan 2), both on this branch.

Core public API consumed: `render(config, snapshot, { surface, width, commandOutputs? }) → RenderModel`, `toAnsi`, `loadConfig(raw) → { config, warnings }`, `defaultConfig`, `importCcstatusline(raw) → { config, warnings }`, `registry` (widget list for the "add item" menu: `Object.values(registry)` gives `{ type, label, format }`), `COLORS`/`isColor`, and types `Config`, `Item`, `WidgetType`, `Snapshot`, `RenderModel`, `Segment`, `ToastRule`.

## Global Constraints

- New workspace package `@ccstatus/tui` at `packages/tui`, **published to npm as `ccstatus`** with a `bin` (`ccstatus` → the built entry). `"type":"module"`. It depends on `@ccstatus/core` (workspace), `ink`, `react`; dev `ink-testing-library`, `tsup`, `typescript`, `vitest`.
- The TUI is a normal Node app — it may use `node:fs`, `node:path`, `node:os`, `ink`, `react`, and `@ccstatus/core`. (Unlike the plugin, there is no sandbox restriction here.)
- Config path (shared with the plugin): `$XDG_CONFIG_HOME/ccstatus/config.json`, else `$HOME/.config/ccstatus/config.json`. Snapshot path: the same dir, `snapshot.json`.
- Config writes are atomic (write temp + `rename`) and keep a `config.json.bak` of the previous content; create the directory if missing.
- The TUI NEVER writes an invalid config: it always rounds its in-memory state through `core.loadConfig` before saving, and renders previews through `core.render` so the preview can't diverge from the mod.
- Every screen shows the pinned live band preview at the bottom (shared `Preview` component), per the approved mockup.
- Named colors only (from core `COLORS`); color pickers are scrollable named-color lists.
- The powerline glyph default stays `▒` (renders in any terminal); the Powerline screen offers ccstatusline's Nerd-Font presets + a custom entry. `invert` is stored in config but not applied by the v1 renderer (like `align`).
- Tests run with Vitest + ink-testing-library (`render` → `lastFrame()`, write keys to `stdin`). No network, no real `~/.config` writes in tests (use a temp dir).

## Review Focus

Inputs the design implies; each gets a test in the owning task:

- **No config file on first run** — TUI opens on `defaultConfig`, no crash. (Task 4)
- **Malformed config on disk** — loads via `core.loadConfig` to a valid config (warnings surfaced), never throws. (Task 4)
- **No snapshot file** — Preview falls back to sample data, clearly labeled. (Task 5)
- **Save is atomic + backed up** — a failed/interrupted write never corrupts `config.json`; the prior version is in `config.json.bak`. (Task 4)
- **Narrow terminal** — screens and the pinned preview reflow/truncate without crashing (preview width tracks terminal columns; core truncates). (Task 6)
- **ccstatusline import of a bad/foreign file** — maps what it can, warns, replaces the band; never throws. (Task 12)

---

## File Structure

```
ccstatus/
├─ packages/core/src/           # Task 1 touches config + render (configurable glyph)
├─ plugin/hooks/register.tsx    # Task 2 (persist snapshot) + rebuild bundle
└─ packages/tui/
   ├─ package.json              # @ccstatus/tui, bin "ccstatus" (Task 3)
   ├─ tsconfig.json  vitest.config.ts  tsup.config.ts   (Task 3)
   └─ src/
      ├─ index.tsx              # #! bin entry → render(<App/>) (Task 3)
      ├─ app.tsx                # root: config state, router, global keys, pinned preview (Task 6)
      ├─ config-store.ts        # configPath/snapshotPath, load, saveAtomic (Task 4)
      ├─ snapshot-source.ts     # readSnapshot(): live-from-disk | sample (Task 5)
      ├─ sample-snapshot.ts     # the sample Snapshot (Task 5)
      ├─ paint.tsx              # RenderModel → Ink <Box>/<Text> (Task 6)
      ├─ preview.tsx            # pinned live band preview component (Task 6)
      ├─ named-colors.ts        # ordered named-color list from core COLORS (Task 7)
      └─ screens/
         ├─ menu.tsx            # (Task 6)
         ├─ items.tsx           # (Task 8)
         ├─ themes.tsx          # (Task 9)
         ├─ powerline.tsx       # (Task 10)
         ├─ surfaces.tsx        # (Task 11)
         ├─ defaults.tsx        # (Task 7)
         └─ import.tsx          # (Task 12)
```

---

### Task 1: Core — configurable powerline glyph (+ stored invert)

**Files:**

- Modify: `packages/core/src/config/types.ts`, `config/defaults.ts`, `config/schema.ts`, `render.ts`
- Test: `packages/core/src/render.test.ts` (add a case)

**Interfaces:**

- Produces: `Defaults` gains `glyph: string` (default `"▒"`) and `invert: boolean` (default `false`, stored-only — not applied by the renderer in v1). `render` passes `config.defaults.glyph` to `composeLine` as its glyph argument. `loadConfig` fills/validates both (non-empty string glyph, boolean invert) and keeps them across migration.

- [ ] **Step 1: Write the failing test** (append to `render.test.ts`)

```ts
test('render uses the configured powerline glyph', () => {
  const cfg = structuredCloneSafe(defaultConfig);
  cfg.defaults.glyph = '►';
  const snap = sampleSnap(); // reuse the test's existing snapshot literal
  const model = render(cfg, snap, { surface: 'band', width: 120 });
  const text = model.lines[0]!.segments.map((s) => s.text).join('');
  expect(text).toContain('►');
  expect(text).not.toContain('▒');
});
```

(Use the file's existing snapshot/clone helpers; if none, inline a minimal snapshot object and `JSON.parse(JSON.stringify(defaultConfig))`.)

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/core -- render` → FAIL (glyph not threaded).

- [ ] **Step 3: Implement**

`config/types.ts`:

```ts
export type Defaults = {
  separator: SeparatorMode;
  padding: number;
  align: Align;
  glyph: string;
  invert: boolean;
};
```

`config/defaults.ts` — in `defaultConfig.defaults`:

```ts
defaults: { separator: 'powerline', padding: 1, align: 'left', glyph: '▒', invert: false },
```

`config/schema.ts` — extend the defaults object schema:

```ts
defaults: z.object({ separator: sep, padding: z.number(), align, glyph: z.string().min(1), invert: z.boolean() }).partial().default({}),
```

`config/validate.ts` — the existing `{ ...defaultConfig.defaults, ...p.defaults }` merge already fills `glyph`/`invert` from defaults; add a guard that a non-string or empty glyph falls back to the default with a warning (mirror the existing coercion style).
`render.ts`:

```ts
.map(cells => ({ segments: composeLine(cells, config.defaults.separator, opts.width, config.defaults.glyph) }))
```

- [ ] **Step 4: Run to verify it passes** — `npm test -w @ccstatus/core` (full suite) + `npm run typecheck -w @ccstatus/core`. Fix any defaults/validate test that now needs `glyph`/`invert` in its expected object.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): make the powerline glyph configurable (defaults.glyph) + store invert"
```

---

### Task 2: Plugin — persist the latest snapshot to disk

**Files:**

- Modify: `plugin/hooks/register.tsx`
- Modify: `plugin/hooks/config-io.ts` (add `snapshotPath`)
- Test: `plugin/hooks/config-io.test.ts` (snapshotPath) — snapshot-write itself is covered by a guarded call; add a kit assertion if practical
- Rebuild: `npm run build:plugin-core` (no core API change needed beyond Task 1; rebuild to pick up Task 1)

**Interfaces:**

- Produces: `snapshotPath(env)` in config-io (sibling of `configPath`, `…/ccstatus/snapshot.json`). On each successful `refresh`, the mod writes the current `Snapshot` as JSON to `snapshotPath` via `$.fs.write` (guarded; failure is swallowed). This is what the TUI Preview reads.

- [ ] **Step 1: Write the failing test** (append to `config-io.test.ts`)

```ts
test('snapshotPath sits beside the config', () => {
  expect(snapshotPath({ HOME: '/home/u' })).toBe('/home/u/.config/ccstatus/snapshot.json');
});
```

- [ ] **Step 2: Run to verify it fails** — `claude plugin test plugin` → FAIL.

- [ ] **Step 3: Implement**

`config-io.ts`:

```ts
export function snapshotPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME'];
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`;
  return `${base}/ccstatus/snapshot.json`;
}
```

`register.tsx` — in `refresh`, after computing `s` and before/after updating the atom, persist it (guarded, never throws):

```ts
try {
  const env = {
    HOME: await $.env.get('HOME').catch(() => undefined),
    XDG_CONFIG_HOME: await $.env.get('XDG_CONFIG_HOME').catch(() => undefined),
  };
  await $.fs.write(snapshotPath(env), JSON.stringify(s)).catch(() => {});
} catch {
  /* ignore snapshot persistence errors */
}
```

Import `snapshotPath` from `./config-io.js`.

- [ ] **Step 4: Run to verify it passes** — `claude plugin test plugin` + `claude plugin validate plugin` (confirm the new env read `HOME`/`XDG_CONFIG_HOME` and `fs.write` show in validate's report; they already do for config). Run `npm run build:plugin-core`.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/config-io.ts plugin/hooks/config-io.test.ts
git commit -m "feat(plugin): persist the latest snapshot to ~/.config/ccstatus/snapshot.json"
```

---

### Task 3: TUI scaffold + bin

**Files:**

- Create: `packages/tui/package.json`, `tsconfig.json`, `vitest.config.ts`, `tsup.config.ts`, `src/index.tsx`, `src/app.tsx` (minimal), `src/smoke.test.tsx`
- Modify: root `package.json` (nothing needed — workspaces already `packages/*`)

**Interfaces:**

- Produces: a runnable `@ccstatus/tui` package; `src/index.tsx` is the bin entry (shebang `#!/usr/bin/env node`) that renders `<App/>`; `App` (minimal) renders a title. `npm test -w @ccstatus/tui` runs; `npm run build -w @ccstatus/tui` emits an executable `dist/index.js`.

- [ ] **Step 1: Write the smoke test**

```tsx
// packages/tui/src/smoke.test.tsx
import { expect, test } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './app.js';

test('App renders its title', () => {
  const { lastFrame, unmount } = render(<App />);
  expect(lastFrame()).toContain('ccstatus');
  unmount();
});
```

- [ ] **Step 2: Create package files**

```json
// packages/tui/package.json
{
  "name": "@ccstatus/tui",
  "version": "0.1.0",
  "type": "module",
  "bin": { "ccstatus": "./dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@ccstatus/core": "workspace:*", "ink": "^5.0.0", "react": "^18.3.0" },
  "devDependencies": {
    "ink-testing-library": "^4.0.0",
    "@types/react": "^18.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

```jsonc
// packages/tui/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src"],
}
```

```ts
// packages/tui/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.tsx', 'src/**/*.test.ts'] } });
```

```ts
// packages/tui/tsup.config.ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['@ccstatus/core'],
  clean: true,
});
```

```tsx
// packages/tui/src/index.tsx
import { render } from 'ink';
import { App } from './app.js';
render(<App />);
```

```tsx
// packages/tui/src/app.tsx
import { Box, Text } from 'ink';
export function App() {
  return (
    <Box flexDirection="column">
      <Text bold>ccstatus · configurator</Text>
    </Box>
  );
}
```

- [ ] **Step 3: Install + test + build**

Run: `npm install && npm test -w @ccstatus/tui && npm run build -w @ccstatus/tui`
Expected: smoke test PASSES; `dist/index.js` exists and starts with the shebang.
(If `workspace:*` is unsupported by the installed npm, use `"*"` for `@ccstatus/core`.)

- [ ] **Step 4: Commit**

```bash
git add packages/tui package.json package-lock.json
git commit -m "feat(tui): scaffold @ccstatus/tui Ink app with ccstatus bin"
```

---

### Task 4: Config store (path, load, atomic save + backup)

**Files:**

- Create: `packages/tui/src/config-store.ts`
- Test: `packages/tui/src/config-store.test.ts`

**Interfaces:**

- Consumes: `loadConfig`, `Config` from `@ccstatus/core`; `node:fs`, `node:path`, `node:os`.
- Produces:
  - `configPath(env = process.env): string` and `snapshotPath(env = process.env): string` (XDG then `$HOME/.config`).
  - `loadConfigFile(path): { config: Config; warnings: string[] }` — reads the file (missing → `loadConfig(undefined)`; unreadable/invalid JSON → `loadConfig(undefined)` + warning); valid JSON → `loadConfig(parsed)`. Never throws.
  - `saveConfigFile(path, config): void` — rounds `config` through `loadConfig` first (so only valid config is written), creates the dir, writes `path + '.tmp'` then `rename`s over `path`, and copies the prior `path` to `path + '.bak'` first when it exists.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/tui/src/config-store.test.ts
import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configPath, snapshotPath, loadConfigFile, saveConfigFile } from './config-store.js';
import { defaultConfig } from '@ccstatus/core';

test('paths honor XDG then HOME', () => {
  expect(configPath({ XDG_CONFIG_HOME: '/x', HOME: '/h' })).toBe('/x/ccstatus/config.json');
  expect(configPath({ HOME: '/h' })).toBe('/h/.config/ccstatus/config.json');
  expect(snapshotPath({ HOME: '/h' })).toBe('/h/.config/ccstatus/snapshot.json');
});
test('missing file loads defaults, no throw', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'config.json');
  const { config } = loadConfigFile(p);
  expect(config.version).toBe(1);
});
test('invalid JSON loads defaults with a warning', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  writeFileSync(p, '{not json');
  const { config, warnings } = loadConfigFile(p);
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});
test('save is atomic + backs up the prior file', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  writeFileSync(p, JSON.stringify({ old: true }));
  saveConfigFile(p, defaultConfig);
  expect(JSON.parse(readFileSync(p, 'utf8')).version).toBe(1);
  expect(existsSync(p + '.bak')).toBe(true);
  expect(JSON.parse(readFileSync(p + '.bak', 'utf8')).old).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/tui -- config-store` → FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/tui/src/config-store.ts
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig } from '@ccstatus/core';
import type { Config } from '@ccstatus/core';

type Env = Record<string, string | undefined>;
const base = (env: Env) => {
  const xdg = env['XDG_CONFIG_HOME'];
  return xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`;
};
export const configPath = (env: Env = process.env) => `${base(env)}/ccstatus/config.json`;
export const snapshotPath = (env: Env = process.env) => `${base(env)}/ccstatus/snapshot.json`;

export function loadConfigFile(path: string): { config: Config; warnings: string[] } {
  let text: string | null = null;
  try {
    text = existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    text = null;
  }
  if (text === null) return loadConfig(undefined);
  try {
    return loadConfig(JSON.parse(text));
  } catch {
    const f = loadConfig(undefined);
    return { config: f.config, warnings: ['config file is not valid JSON; using defaults'] };
  }
}

export function saveConfigFile(path: string, config: Config): void {
  const { config: clean } = loadConfig(config); // only ever write valid config
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    try {
      copyFileSync(path, path + '.bak');
    } catch {
      /* best effort */
    }
  }
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(clean, null, 2));
  renameSync(tmp, path);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -w @ccstatus/tui -- config-store` + `npm run typecheck -w @ccstatus/tui`.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/config-store.ts packages/tui/src/config-store.test.ts
git commit -m "feat(tui): config store with atomic save + backup"
```

---

### Task 5: Snapshot source (live from disk, else sample)

**Files:**

- Create: `packages/tui/src/sample-snapshot.ts`, `packages/tui/src/snapshot-source.ts`
- Test: `packages/tui/src/snapshot-source.test.ts`

**Interfaces:**

- Consumes: `Snapshot` from `@ccstatus/core`; `node:fs`.
- Produces:
  - `sampleSnapshot: Snapshot` — the mockup's sample (Opus 4.8, 42k ctx 21%, 30% session, git repo app/main, tokens) so previews look like the mockup.
  - `readSnapshot(path): { snapshot: Snapshot; source: 'live' | 'sample'; mtimeMs?: number }` — when `path` exists and parses to an object, merge it over `sampleSnapshot` (so missing fields are filled) and return `source:'live'` with the file mtime; otherwise return `sampleSnapshot` with `source:'sample'`. Never throws.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/tui/src/snapshot-source.test.ts
import { expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSnapshot } from './snapshot-source.js';
import { sampleSnapshot } from './sample-snapshot.js';

test('falls back to sample when no file', () => {
  const r = readSnapshot(join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json'));
  expect(r.source).toBe('sample');
  expect(r.snapshot.model).toBe(sampleSnapshot.model);
});
test('reads a live snapshot and fills gaps from sample', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, JSON.stringify({ model: 'Haiku', ctxTokens: 999 }));
  const r = readSnapshot(p);
  expect(r.source).toBe('live');
  expect(r.snapshot.model).toBe('Haiku');
  expect(r.snapshot.ctxTokens).toBe(999);
  expect(typeof r.snapshot.now).toBe('number'); // filled from sample
});
test('bad JSON falls back to sample, no throw', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, '{bad');
  expect(readSnapshot(p).source).toBe('sample');
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/tui -- snapshot-source` → FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/tui/src/sample-snapshot.ts
import type { Snapshot } from '@ccstatus/core';
export const sampleSnapshot: Snapshot = {
  version: '2.1.0',
  model: 'Opus 4.8',
  effort: 'high',
  cwd: '/home/you/app',
  repo: true,
  gitRoot: 'app',
  gitBranch: 'main',
  gitWorktree: '',
  added: 1,
  modified: 2,
  deleted: 0,
  ctxTokens: 42000,
  ctxPct: 21,
  cached: 1000,
  input: 2000,
  output: 500,
  total: 3500,
  startedAt: 0,
  cost: null,
  fivePct: 30,
  fiveReset: null,
  weekPct: 10,
  weekReset: null,
  blockReset: null,
  terminalWidth: 0,
  now: 65000,
};
```

```ts
// packages/tui/src/snapshot-source.ts
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { Snapshot } from '@ccstatus/core';
import { sampleSnapshot } from './sample-snapshot.js';

export function readSnapshot(path: string): {
  snapshot: Snapshot;
  source: 'live' | 'sample';
  mtimeMs?: number;
} {
  try {
    if (!existsSync(path)) return { snapshot: sampleSnapshot, source: 'sample' };
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object')
      return { snapshot: sampleSnapshot, source: 'sample' };
    return {
      snapshot: { ...sampleSnapshot, ...parsed },
      source: 'live',
      mtimeMs: statSync(path).mtimeMs,
    };
  } catch {
    return { snapshot: sampleSnapshot, source: 'sample' };
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -w @ccstatus/tui -- snapshot-source`.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/sample-snapshot.ts packages/tui/src/snapshot-source.ts packages/tui/src/snapshot-source.test.ts
git commit -m "feat(tui): snapshot source (live from disk, else sample)"
```

---

### Task 6: paint + pinned Preview + App router + Menu

**Files:**

- Create: `packages/tui/src/paint.tsx`, `src/preview.tsx`, `src/screens/menu.tsx`
- Modify: `src/app.tsx`
- Test: `packages/tui/src/preview.test.tsx`, `src/app.test.tsx`

**Interfaces:**

- Consumes: `render`, `RenderModel`, `Segment`, `Config` from core; `readSnapshot`, `snapshotPath`, `loadConfigFile`, `configPath`; Ink `Box`/`Text`/`useInput`/`useApp`.
- Produces:
  - `paintModel(model: RenderModel): JSX.Element` — a column `<Box>`; one row `<Box>` per line; one `<Text color={seg.fg} backgroundColor={seg.bg}>{seg.text}</Text>` per segment. (fg/bg are core's named colors, which Ink accepts.)
  - `Preview({ config, snapshot, source, width })` — renders the band surface via `render(config, snapshot, { surface:'band', width })` → `paintModel`, with a one-line header `live preview · band · <width> cols · <source>`.
  - `App` — on mount: `loadConfigFile(configPath())` into state; `readSnapshot(snapshotPath())`; render the active screen (default `menu`) above a persistent `<Preview/>`; global keys: `q` quits (`useApp().exit`), number/arrow nav handled by Menu. A `screen` state + `setScreen` routes; each screen gets `{ config, setConfig, goHome }`.
  - `Menu({ onSelect })` — the 8 entries + Save/Quit; `useInput` moves selection and triggers `onSelect(id)`; selecting `save` calls `saveConfigFile`.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/tui/src/preview.test.tsx
import { expect, test } from 'vitest';
import { render } from 'ink-testing-library';
import { Preview } from './preview.js';
import { sampleSnapshot } from './sample-snapshot.js';
import { defaultConfig } from '@ccstatus/core';

test('Preview renders the default band with content', () => {
  const { lastFrame, unmount } = render(
    <Preview config={defaultConfig} snapshot={sampleSnapshot} source="sample" width={120} />
  );
  const f = lastFrame()!;
  expect(f).toContain('Ctx');
  expect(f).toContain('sample');
  unmount();
});
```

```tsx
// packages/tui/src/app.test.tsx
import { expect, test } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './app.js';
test('App shows the menu and the pinned preview', () => {
  const { lastFrame, unmount } = render(<App />);
  const f = lastFrame()!;
  expect(f).toContain('Edit items'); // menu entry
  expect(f).toContain('live preview'); // pinned preview header
  unmount();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/tui -- preview app` → FAIL.

- [ ] **Step 3: Implement paint + Preview**

```tsx
// packages/tui/src/paint.tsx
import { Box, Text } from 'ink';
import type { RenderModel } from '@ccstatus/core';
export function paintModel(model: RenderModel) {
  return (
    <Box flexDirection="column">
      {model.lines.map((line, i) => (
        <Box key={i}>
          {line.segments.map((s, j) => (
            <Text key={j} color={s.fg} backgroundColor={s.bg}>
              {s.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

```tsx
// packages/tui/src/preview.tsx
import { Box, Text } from 'ink';
import { render as renderBar } from '@ccstatus/core';
import type { Config, Snapshot } from '@ccstatus/core';
import { paintModel } from './paint.js';
export function Preview({
  config,
  snapshot,
  source,
  width,
}: {
  config: Config;
  snapshot: Snapshot;
  source: 'live' | 'sample';
  width: number;
}) {
  const model = renderBar(config, snapshot, { surface: 'band', width });
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray">
        live preview · band · {width} cols · {source} data
      </Text>
      {paintModel(model)}
    </Box>
  );
}
```

- [ ] **Step 4: Implement App + Menu** (route between screens; pinned preview always rendered). Keep screen components imported lazily as they land in later tasks — for this task, `menu` is the only real screen; other ids can render a `<Text>coming soon</Text>` placeholder UNTIL their task replaces them. Use `process.stdout.columns || 120` for preview width; re-read on Ink's resize if available.

```tsx
// packages/tui/src/app.tsx
import { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { configPath, snapshotPath, loadConfigFile, saveConfigFile } from './config-store.js';
import { readSnapshot } from './snapshot-source.js';
import { Preview } from './preview.js';
import { Menu } from './screens/menu.js';
import type { Config } from '@ccstatus/core';

export function App() {
  const { exit } = useApp();
  const [config, setConfig] = useState<Config>(() => loadConfigFile(configPath()).config);
  const [screen, setScreen] = useState('menu');
  const snap = readSnapshot(snapshotPath());
  const width = process.stdout.columns || 120;
  useInput((input) => {
    if (screen === 'menu' && input === 'q') exit();
  });

  const save = () => {
    try {
      saveConfigFile(configPath(), config);
    } catch {
      /* surfaced in UI later */
    }
  };
  const common = { config, setConfig, goHome: () => setScreen('menu') };

  return (
    <Box flexDirection="column" paddingX={1}>
      {screen === 'menu' ? (
        <Menu
          onSelect={(id) => {
            if (id === 'quit') exit();
            else if (id === 'save') {
              save();
              exit();
            } else setScreen(id);
          }}
        />
      ) : (
        <PlaceholderOrScreen id={screen} {...common} />
      )}
      <Preview config={config} snapshot={snap.snapshot} source={snap.source} width={width} />
    </Box>
  );
}
// PlaceholderOrScreen: switch on id → the real screen component once its task lands; else <Text>…</Text>.
```

(Each later task swaps its placeholder for the real screen and asserts via the App or standalone.)

```tsx
// packages/tui/src/screens/menu.tsx
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
const ITEMS = [
  ['items', 'Edit items'],
  ['themes', 'Themes'],
  ['powerline', 'Powerline & separators'],
  ['surfaces', 'Surfaces'],
  ['defaults', 'Global defaults'],
  ['preview', 'Preview'],
  ['import', 'Import from ccstatusline'],
  ['save', 'Save & quit'],
  ['quit', 'Quit without saving'],
] as const;
export function Menu({ onSelect }: { onSelect: (id: string) => void }) {
  const [i, setI] = useState(0);
  useInput((input, key) => {
    if (key.upArrow) setI((v) => Math.max(0, v - 1));
    else if (key.downArrow) setI((v) => Math.min(ITEMS.length - 1, v + 1));
    else if (key.return) onSelect(ITEMS[i]![0]);
  });
  return (
    <Box flexDirection="column">
      <Text bold>ccstatus · configurator</Text>
      {ITEMS.map(([id, label], idx) => (
        <Text key={id} color={idx === i ? 'cyan' : undefined}>
          {idx === i ? '▸ ' : '  '}
          {label}
        </Text>
      ))}
    </Box>
  );
}
```

- [ ] **Step 5: Run to verify it passes** — `npm test -w @ccstatus/tui` + typecheck. The App test sees the menu + the pinned preview.

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/paint.tsx packages/tui/src/preview.tsx packages/tui/src/app.tsx packages/tui/src/screens/menu.tsx packages/tui/src/preview.test.tsx packages/tui/src/app.test.tsx
git commit -m "feat(tui): paint, pinned preview, app router, and main menu"
```

---

### Task 7: named-colors + Defaults screen

**Files:**

- Create: `packages/tui/src/named-colors.ts`, `src/screens/defaults.tsx`
- Modify: `src/app.tsx` (route `defaults`)
- Test: `packages/tui/src/screens/defaults.test.tsx`

**Interfaces:**

- Produces:
  - `NAMED_COLORS: string[]` — ordered foreground then background names derived from core `COLORS` (stable order for pickers), plus a leading `'(none)'` sentinel meaning "unset".
  - `Defaults({ config, setConfig, goHome })` — edits `defaults.separator` (powerline/space/none) and `defaults.padding` (0–4) with ←/→; shows `align` greyed with "stored, not yet applied"; `esc` returns home. Mutations call `setConfig` with an updated clone.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/tui/src/screens/defaults.test.tsx
import { expect, test, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Defaults } from './defaults.js';
import { defaultConfig } from '@ccstatus/core';

test('Defaults shows separator/padding and greys align', () => {
  const { lastFrame, unmount } = render(
    <Defaults config={defaultConfig} setConfig={() => {}} goHome={() => {}} />
  );
  const f = lastFrame()!;
  expect(f).toContain('separator');
  expect(f).toContain('powerline');
  expect(f).toContain('align');
  expect(f).toContain('not yet applied');
  unmount();
});
test('← / → changes padding via setConfig', () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Defaults config={defaultConfig} setConfig={setConfig} goHome={() => {}} />
  );
  stdin.write('\u001B[C'); // right arrow → focus/adjust (screen moves focus to padding then adjusts; see impl)
  unmount();
  // at least assert the component mounted & is interactive; detailed assertion in impl notes
});
```

(Keep the interaction assertion light; the key behavior — padding changes produce a new config via setConfig — is asserted once the impl's focus model is fixed. Implementer: make `←/→` adjust the focused field and call setConfig, and assert setConfig was called with `defaults.padding` changed.)

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/tui -- defaults` → FAIL.

- [ ] **Step 3: Implement** `named-colors.ts` (from `COLORS`, foreground names first, then `bg*`, prefixed with `'(none)'`), and `defaults.tsx` (a small field list with ↑/↓ to move focus between `separator` and `padding`, ←/→ to change the focused field, `align` rendered `color="gray"` with the note, `esc`→`goHome`). Route `defaults` in `app.tsx`.

- [ ] **Step 4: Run to verify it passes** — `npm test -w @ccstatus/tui` + typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/named-colors.ts packages/tui/src/screens/defaults.tsx packages/tui/src/screens/defaults.test.tsx packages/tui/src/app.tsx
git commit -m "feat(tui): named-color list and Defaults screen"
```

---

### Task 8: Edit items screen

**Files:**

- Create: `packages/tui/src/screens/items.tsx`
- Modify: `src/app.tsx` (route `items`)
- Test: `packages/tui/src/screens/items.test.tsx`

**Interfaces:**

- Consumes: `registry` (widget catalog), `Item`, `WidgetType`, `Config` from core; `NAMED_COLORS`.
- Produces: `Items({ config, setConfig, goHome })` — surface tabs (band/statusline/pane) via `tab`; a horizontal strip of the active line's items with a selection cursor; the selected item expands into an inline editor (type shown; `fg`/`bg` chosen from the named-color list; `raw`/`merge` toggles; `align`); keys: `←/→` move/reorder, `a` add (opens a widget-type picker from `Object.values(registry)`), `x` remove, `e` edit (focus the inline editor), `tab` cycle surface, `esc` home. Every mutation produces a new `Config` via `setConfig` and must keep the config valid (shape matches `SurfaceLayout.lines: Item[][]`). IDs for new items: a short unique string (e.g. `` `${type}-${Date.now().toString(36)}` ``).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/tui/src/screens/items.test.tsx
import { expect, test, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Items } from './items.js';
import { defaultConfig } from '@ccstatus/core';

test('lists the band items and can remove one', () => {
  const setConfig = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={() => {}} />
  );
  expect(lastFrame()).toContain('version');
  expect(lastFrame()).toContain('model');
  stdin.write('x'); // remove the selected (first) item
  expect(setConfig).toHaveBeenCalled();
  const next = setConfig.mock.calls.at(-1)![0];
  expect(next.surfaces.band.lines[0].length).toBe(defaultConfig.surfaces.band.lines[0].length - 1);
  unmount();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -w @ccstatus/tui -- items` → FAIL.

- [ ] **Step 3: Implement** `items.tsx` per the interface (the horizontal strip + inline editor from the mockup). Route `items` in `app.tsx`.

- [ ] **Step 4: Run to verify it passes** — `npm test -w @ccstatus/tui` + typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/screens/items.tsx packages/tui/src/screens/items.test.tsx packages/tui/src/app.tsx
git commit -m "feat(tui): Edit items screen (strip + inline editor)"
```

---

### Task 9: Themes screen

**Files:**

- Create: `packages/tui/src/screens/themes.tsx`, and (if not already in core) built-in themes.
- Test: `packages/tui/src/screens/themes.test.tsx`

**Interfaces:**

- **Decision to resolve in-task:** the 9 ccstatusline built-in themes (Default, Classic, Nord, Dracula, Gruvbox, Monokai, One Dark, Solarized, Tokyo Night) need concrete per-widget color values. Add them as `builtinThemes: Record<string, Theme>` in **core** (`packages/core/src/theme/themes.ts`, re-exported) so both the TUI and the mod share them, and set `defaultConfig.themes` to include them. Derive each theme's widget colors from ccstatusline's palettes (named terminal colors only). This is a core addition — do it here with its own core test (each theme is a valid `Theme` with known colors) and rebuild the plugin bundle.
- Produces: `Themes({ config, setConfig, goHome })` — lists the themes (active = `config.theme`), `⏎` activates a theme (sets `config.theme`), shows the active theme's per-widget colors, and a named-color-list picker to edit a widget's fg/bg within the selected theme; `n` new, `d` duplicate.

- [ ] **Step 1: Write the failing tests** — a core test that `builtinThemes` has all 9 keys and each value's colors pass `isColor`; a TUI test that the Themes screen lists the themes and `⏎` activates one (setConfig called with new `theme`).

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** `builtinThemes` in core (+ export + fold into `defaultConfig.themes`), rebuild `npm run build:plugin-core`, then `themes.tsx`. Route `themes`.

- [ ] **Step 4: Run to verify it passes** — core suite + `npm test -w @ccstatus/tui` + both typechecks.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theme packages/core/src/config/defaults.ts packages/tui/src/screens/themes.tsx packages/tui/src/screens/themes.test.tsx packages/tui/src/app.tsx
git commit -m "feat: ship ccstatusline's 9 built-in themes and the Themes screen"
```

---

### Task 10: Powerline screen

**Files:**

- Create: `packages/tui/src/screens/powerline.tsx`, `src/separators.ts`
- Test: `packages/tui/src/screens/powerline.test.tsx`

**Interfaces:**

- Produces:
  - `SEPARATOR_PRESETS: { char: string; name: string; code: string }[]` — ccstatusline's presets: Triangle Right ``, Triangle Left ``, Round Right ``, Round Left ``, Lower Triangle ``, Diagonal `` (each with its `U+E0Bx` label).
  - `Powerline({ config, setConfig, goHome })` — `←/→` cycles `defaults.separator` (powerline/space/none); a glyph list of the presets plus a **Custom…** entry (type any character; display `Custom (U+XXXX)`); selecting sets `defaults.glyph`; an `invert` toggle setting `defaults.invert` (stored-only; shown with a "not applied" hint). The pinned preview reflects the chosen glyph live.

- [ ] **Step 1: Write the failing test** — Powerline screen shows the preset names + current separator; choosing `space` calls setConfig with `defaults.separator==='space'`; choosing a preset sets `defaults.glyph` to its char.

- [ ] **Step 2–5:** fail → implement `separators.ts` + `powerline.tsx`, route it, pass, commit `feat(tui): Powerline screen (presets + custom glyph + invert)`.

---

### Task 11: Surfaces screen (+ inline toast rules)

**Files:**

- Create: `packages/tui/src/screens/surfaces.tsx`, `src/toast-presets.ts`
- Test: `packages/tui/src/screens/surfaces.test.tsx`

**Interfaces:**

- Produces:
  - `TOAST_PRESETS: { label: string; when: string; text: string }[]` — Context high (`ctxPct>80`), Context critical (`ctxPct>95`), Session limit near (`fivePct>90`), Weekly limit near (`weekPct>80`).
  - `Surfaces({ config, setConfig, goHome })` — toggles `surfaces.{band,statusline,pane,toasts}.enabled` with `space`; edits `surfaces.toasts.rules` inline: `a` adds a rule (pick a preset or Custom), each rule's `when` is an editable mini-expression (`field op number`), `text` and `once` editable, `x` removes. Validates `when` against the field/op grammar (`ctxPct|fivePct|weekPct|ctxTokens|total|cost` and `> >= < <= ==`), marking an invalid expression but never crashing.

- [ ] **Step 1: Write the failing test** — Surfaces lists the four surfaces with checkboxes; `space` on `statusline` toggles its `enabled` via setConfig; the existing toast rule `ctxPct>80` is shown; adding a preset rule appends to `surfaces.toasts.rules`.

- [ ] **Step 2–5:** fail → implement → route → pass → commit `feat(tui): Surfaces screen with inline toast rules`.

---

### Task 12: Import screen

**Files:**

- Create: `packages/tui/src/screens/import.tsx`
- Test: `packages/tui/src/screens/import.test.tsx`

**Interfaces:**

- Consumes: `importCcstatusline` from core; `node:fs`, `node:os`.
- Produces: `Import({ config, setConfig, goHome })` — source selector: the auto-detected default ccstatusline path (`$XDG_CONFIG_HOME|~/.config` → `ccstatusline/settings.json`) plus a **custom path** text entry; reads the chosen file, runs `importCcstatusline(JSON.parse(text))`, shows the map/dropped summary (warnings), and on `⏎` **replaces** `config.surfaces.band` with the imported band and calls `setConfig`. A missing/foreign/bad file shows the warning and never throws.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/tui/src/screens/import.test.tsx
import { expect, test, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Import } from './import.js';
import { defaultConfig } from '@ccstatus/core';

test('maps a ccstatusline file into the band and replaces it', () => {
  // The screen reads a path; drive it with a custom path pointing at a temp file,
  // OR inject the file text via a test prop/hook the impl exposes. Implementer:
  // expose a seam (e.g. an optional `readFile` prop defaulting to fs) so the test
  // can supply `{ version:1, lines:[[{id:'v',type:'version'}]] }` and assert
  // setConfig is called with surfaces.band.lines[0] mapped to a 'version' item.
  expect(typeof Import).toBe('function');
});
```

(Implementer: add a small injectable `readFile(path):string|null` prop, default `fs`-based, so the import mapping is unit-testable without touching the real home dir. Then assert the mapping + band replacement concretely.)

- [ ] **Step 2–5:** fail → implement `import.tsx` (detect + custom path + map + replace band) → route → pass → commit `feat(tui): Import from ccstatusline (detect + custom file, replace band)`.

---

### Task 13: Final wiring + package polish + gate

**Files:**

- Modify: `packages/tui/src/app.tsx` (ensure all 8 ids route to real screens; `preview` id focuses the pinned preview / a fuller Preview screen with width + surface toggles), `packages/tui/package.json` (publish fields: `description`, `license`, `repository` placeholder, `engines.node >=20`).
- Test: a final `app.test.tsx` case that every menu entry routes without crashing.

**Interfaces:**

- Produces: a complete TUI where every screen is reachable from the menu, saves round-trip through `core.loadConfig`, and the build emits a working `ccstatus` bin.

- [ ] **Step 1: Write the failing test** — iterate the menu ids, select each, assert `lastFrame()` renders (no throw) and still shows `live preview`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** the remaining routing + a `Preview` screen (reuses `Preview` with `w` width / `s` surface controls) + package publish fields.
- [ ] **Step 4: FINAL GATE** — run all, must be clean:
  - `npm test -w @ccstatus/core && npm test -w @ccstatus/tui`
  - `npm run typecheck -w @ccstatus/core && npm run typecheck -w @ccstatus/tui`
  - `npm run build -w @ccstatus/tui` (emits `dist/index.js` with shebang)
  - `npm run build:plugin-core && claude plugin validate plugin && claude plugin test plugin` (plugin still green after core changes)
- [ ] **Step 5: Commit** `feat(tui): complete screen routing, Preview controls, and publish metadata`

---

## Deferred (carried, not in this plan)

- `invert` separators and per-item `align` remain stored-but-not-rendered (documented in the screens).
- Live-updating preview while the mod runs (the TUI reads the snapshot once per launch / on `r`); a file-watch refresh is a later nicety.
- Statusline fixed-width (200) in the mod — revisit when a width source for that surface exists.

## What's next

- **Plan 4 — Packaging & release:** `.claude-plugin/marketplace.json`, npm publish config for `ccstatus` (the TUI) + the plugin as a marketplace entry, README + demo gif, CI (lint/test/build across workspaces), and the deferred cleanups (commit-trailer attribution, statusline width, setTheme sparse-write guard).
