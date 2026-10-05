# ccstatus Plan 1 — Foundation + Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ccstatus/core`, a pure TypeScript library that turns a `ccstatus` config + a data `Snapshot` into a surface-agnostic `RenderModel` (and an ANSI string), with no dependency on `claude-code` or `ink`.

**Architecture:** Core is the single source of truth for _how the bar looks_. It exposes `render(config, snapshot, opts) => RenderModel`, which both the mod and the Ink TUI will paint later. Everything is pure and heavily unit-tested so the two future painters stay honest and the TUI preview matches the live bar.

**Tech Stack:** TypeScript (strict, ESM, `NodeNext`), npm workspaces, Vitest (tests), Zod (config validation). Node ≥ 20.

**Spec:** `docs/superpowers/specs/2026-10-04-ccstatus-design.md`

## Global Constraints

- Core must import **nothing** from `claude-code` or `ink` (it is synced into the mod's module environment, which has no `node_modules` resolution and no Node/DOM). Pure TS + `zod` only.
- Package name: `@ccstatus/core`; it is an internal workspace package, **not published** to npm (`"private": true`).
- TypeScript strict mode on; module resolution `NodeNext`; output ESM; target `ES2022`.
- Named terminal colors only (the ccstatusline/existing-mod vocabulary): foregrounds `black white red green yellow blue magenta cyan gray` plus `bright*` variants; backgrounds `bgBlack bgWhite bgRed bgGreen bgYellow bgBlue bgMagenta bgCyan bgGray` plus `bgBright*` variants. No hex colors in v1.
- Config `version` is the literal `1` in v1.
- Core never throws on user-supplied config: it validates, migrates, fills defaults, and drops invalid parts with a recorded warning string.
- Powerline cap/separator default glyph is `▒` (matches the existing `ccstatusline-band` mod); powerline separators are colored `fg = previous cell bg`, `bg = next cell bg`.
- All widget `format` functions are pure: given the same `WidgetContext` they return the same `string | null` (`null` means "omit this item").

## Review Focus

Input classes the spec implies that are most likely to bite a user; each gets a test in the owning task:

- **Malformed or older-version config JSON** — a hand-edited/old file must load to a valid config with warnings, never throw. (Task 4)
- **Width smaller than content** — truncation must not emit negative padding, must keep powerline caps balanced, and must never throw. (Task 11)
- **Not in a git repo** — every git widget returns `null` (omitted), not an error string. (Task 6)
- **Missing/null usage fields** — `cost`, rate-limit %, and reset times absent ⇒ widget omits or shows an em-dash per its rule, never `NaN`/`undefined`. (Task 7)
- **Unknown widget type or unknown color name in config** — unknown item `type` is dropped with a warning; unknown color names are dropped (fall back to theme/none) with a warning, not rendered literally. (Task 4)

---

## File Structure

```
ccstatus/
├─ package.json                         # workspaces root (Task 1)
├─ tsconfig.base.json                   # shared compiler options (Task 1)
└─ packages/core/
   ├─ package.json                      # @ccstatus/core (Task 1)
   ├─ tsconfig.json                     # extends base (Task 1)
   ├─ vitest.config.ts                  # (Task 1)
   └─ src/
      ├─ index.ts                       # public exports (Task 15)
      ├─ snapshot.ts                    # Snapshot type (Task 3)
      ├─ render-model.ts                # Segment/RenderLine/RenderModel (Task 3)
      ├─ colors.ts                      # color name set + isColor (Task 3)
      ├─ format.ts                      # fmtNum/fmtDur/pct/bar (Task 2)
      ├─ config/
      │  ├─ types.ts                    # Config/Item/... (Task 3)
      │  ├─ defaults.ts                 # defaultConfig (Task 4)
      │  ├─ schema.ts                   # zod schema (Task 4)
      │  ├─ validate.ts                 # loadConfig() (Task 4)
      │  └─ import-ccstatusline.ts      # importCcstatusline() (Task 14)
      ├─ widgets/
      │  ├─ types.ts                    # WidgetContext/WidgetDef (Task 5)
      │  ├─ registry.ts                 # registry map (Tasks 5–8)
      │  ├─ data-widgets.ts             # (Task 5)
      │  ├─ git-widgets.ts              # (Task 6)
      │  ├─ usage-widgets.ts            # (Task 7)
      │  └─ custom-widgets.ts           # (Task 8)
      ├─ theme/themes.ts                # builtinThemes + resolveColors (Task 9)
      ├─ layout/
      │  ├─ cells.ts                    # itemToCell/lineToCells (Task 10)
      │  └─ compose.ts                  # composeLine() (Task 11)
      ├─ render.ts                      # render() (Task 12)
      └─ ansi.ts                        # toAnsi() (Task 13)
```

---

### Task 1: Monorepo + core package scaffold

**Files:**

- Create: `package.json`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Test: `packages/core/src/smoke.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: a working `npm test` at the repo root that runs Vitest in `packages/core`.

- [ ] **Step 1: Write the smoke test**

```ts
// packages/core/src/smoke.test.ts
import { expect, test } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 2: Create the root workspace manifest**

```json
// package.json
{
  "name": "ccstatus-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "tsc -b"
  }
}
```

- [ ] **Step 3: Create the shared TS config**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 4: Create the core package files**

```json
// packages/core/package.json
{
  "name": "@ccstatus/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "devDependencies": { "vitest": "^2.0.0", "typescript": "^5.5.0" },
  "dependencies": { "zod": "^3.23.0" }
}
```

```json
// packages/core/tsconfig.json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

```ts
// packages/core/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 5: Install and run**

Run: `npm install && npm test`
Expected: Vitest runs; `smoke.test.ts` PASSES.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.base.json packages/core package-lock.json
git commit -m "chore: scaffold monorepo and @ccstatus/core"
```

---

### Task 2: Format helpers

**Files:**

- Create: `packages/core/src/format.ts`
- Test: `packages/core/src/format.test.ts`

**Interfaces:**

- Produces:
  - `fmtNum(n: number): string` — compact: `<1000` as-is; `≥1e3` → `"1.5k"`; `≥1e6` → `"1.2M"` (one decimal, trailing `.0` trimmed).
  - `fmtDur(ms: number): string` — `"45s"`, `"3m 4s"`, `"1h 2m"` (two largest non-zero units; negatives clamp to `"0s"`).
  - `pct(x: number): string` — `x` is 0–100; returns rounded integer + `"%"` (e.g. `42.6` → `"43%"`).
  - `bar(x: number, width = 5): string` — `x` 0–100 → a block bar of `width` chars using `█` filled and `░` empty.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/format.test.ts
import { expect, test } from 'vitest';
import { bar, fmtDur, fmtNum, pct } from './format.js';

test('fmtNum', () => {
  expect(fmtNum(42)).toBe('42');
  expect(fmtNum(1500)).toBe('1.5k');
  expect(fmtNum(2000)).toBe('2k');
  expect(fmtNum(1_200_000)).toBe('1.2M');
});
test('fmtDur', () => {
  expect(fmtDur(45_000)).toBe('45s');
  expect(fmtDur(184_000)).toBe('3m 4s');
  expect(fmtDur(3_720_000)).toBe('1h 2m');
  expect(fmtDur(-5)).toBe('0s');
});
test('pct', () => {
  expect(pct(42.6)).toBe('43%');
  expect(pct(0)).toBe('0%');
});
test('bar', () => {
  expect(bar(0)).toBe('░░░░░');
  expect(bar(100)).toBe('█████');
  expect(bar(50, 4)).toBe('██░░');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- format`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// packages/core/src/format.ts
export function fmtNum(n: number): string {
  const trim = (v: number, suffix: string) => `${v.toFixed(1).replace(/\.0$/, '')}${suffix}`;
  if (Math.abs(n) >= 1_000_000) return trim(n / 1_000_000, 'M');
  if (Math.abs(n) >= 1_000) return trim(n / 1_000, 'k');
  return String(Math.round(n));
}

export function fmtDur(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function pct(x: number): string {
  return `${Math.round(x)}%`;
}

export function bar(x: number, width = 5): string {
  const filled = Math.round((Math.min(100, Math.max(0, x)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/format.ts packages/core/src/format.test.ts
git commit -m "feat(core): add format helpers (fmtNum/fmtDur/pct/bar)"
```

---

### Task 3: Core types + color vocabulary

**Files:**

- Create: `packages/core/src/snapshot.ts`, `packages/core/src/render-model.ts`, `packages/core/src/colors.ts`, `packages/core/src/config/types.ts`
- Test: `packages/core/src/colors.test.ts`

**Interfaces:**

- Produces (types):
  - `Snapshot` (exact fields below).
  - `Segment = { text: string; fg?: string; bg?: string; kind: 'cell'|'separator'|'cap'|'flex' }`, `RenderLine = { segments: Segment[] }`, `RenderModel = { lines: RenderLine[] }`.
  - `WidgetType` union (20 members), `Item`, `Align`, `SeparatorMode`, `SurfaceLayout`, `ToastRule`, `ToastSurface`, `Theme`, `Defaults`, `Config`.
- Produces (runtime): `COLORS: ReadonlySet<string>`, `isColor(x: unknown): x is string`.

- [ ] **Step 1: Write the color test**

```ts
// packages/core/src/colors.test.ts
import { expect, test } from 'vitest';
import { isColor } from './colors.js';

test('isColor', () => {
  expect(isColor('red')).toBe(true);
  expect(isColor('bgBrightYellow')).toBe(true);
  expect(isColor('fuchsia')).toBe(false);
  expect(isColor(42)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- colors`
Expected: FAIL.

- [ ] **Step 3: Implement colors**

```ts
// packages/core/src/colors.ts
const BASE = [
  'black',
  'white',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'gray',
] as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const fg = BASE.flatMap((c) => [c, `bright${cap(c)}`]);
const bg = BASE.flatMap((c) => [`bg${cap(c)}`, `bgBright${cap(c)}`]);
export const COLORS: ReadonlySet<string> = new Set([...fg, ...bg]);
export function isColor(x: unknown): x is string {
  return typeof x === 'string' && COLORS.has(x);
}
```

- [ ] **Step 4: Implement the type modules**

```ts
// packages/core/src/snapshot.ts
export type Snapshot = {
  version: string;
  model: string;
  effort: string | null;
  cwd: string;
  repo: boolean;
  gitRoot: string;
  gitBranch: string;
  gitWorktree: string;
  added: number;
  modified: number;
  deleted: number;
  ctxTokens: number;
  ctxPct: number;
  cached: number;
  input: number;
  output: number;
  total: number;
  startedAt: number;
  cost: number | null;
  fivePct: number | null;
  fiveReset: string | null;
  weekPct: number | null;
  weekReset: string | null;
  blockReset: string | null;
  terminalWidth: number;
  now: number;
};
```

```ts
// packages/core/src/render-model.ts
export type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
export type Segment = { text: string; fg?: string; bg?: string; kind: SegmentKind };
export type RenderLine = { segments: Segment[] };
export type RenderModel = { lines: RenderLine[] };
```

```ts
// packages/core/src/config/types.ts
export type Align = 'left' | 'center' | 'right';
export type SeparatorMode = 'powerline' | 'space' | 'none';

export type WidgetType =
  | 'model'
  | 'version'
  | 'context-length'
  | 'context-percentage'
  | 'tokens-input'
  | 'tokens-output'
  | 'tokens-cached'
  | 'tokens-total'
  | 'session-clock'
  | 'cwd'
  | 'git-branch'
  | 'git-changes'
  | 'git-worktree'
  | 'git-root-dir'
  | 'cost'
  | 'rate-limit-5h'
  | 'rate-limit-week'
  | 'block-timer'
  | 'custom-text'
  | 'custom-command'
  | 'flex-separator';

export type Item = {
  id: string;
  type: WidgetType;
  fg?: string;
  bg?: string;
  merge?: boolean;
  align?: Align;
  rawValue?: boolean;
  metadata?: Record<string, unknown>;
};

export type SurfaceLayout = { enabled: boolean; lines: Item[][] };
export type ToastRule = { when: string; text: string; once?: boolean };
export type ToastSurface = { enabled: boolean; rules: ToastRule[] };
export type Theme = Record<string, { fg?: string; bg?: string }>;
export type Defaults = { separator: SeparatorMode; padding: number; align: Align };

export type Config = {
  version: 1;
  theme: string;
  themes: Record<string, Theme>;
  defaults: Defaults;
  surfaces: {
    band: SurfaceLayout;
    statusline: SurfaceLayout;
    pane: SurfaceLayout;
    toasts: ToastSurface;
  };
};
```

- [ ] **Step 5: Run to verify tests pass + typecheck**

Run: `npm test -w @ccstatus/core -- colors && npm run typecheck -w @ccstatus/core`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/snapshot.ts packages/core/src/render-model.ts packages/core/src/colors.ts packages/core/src/colors.test.ts packages/core/src/config/types.ts
git commit -m "feat(core): add Snapshot, RenderModel, config types, color vocabulary"
```

---

### Task 4: Config defaults, schema, and `loadConfig`

**Files:**

- Create: `packages/core/src/config/defaults.ts`, `packages/core/src/config/schema.ts`, `packages/core/src/config/validate.ts`
- Test: `packages/core/src/config/validate.test.ts`

**Interfaces:**

- Consumes: `Config`, `Item`, `WidgetType`, `isColor`.
- Produces:
  - `defaultConfig: Config` — band enabled with a sensible starter layout; statusline/pane disabled; toasts enabled with one rule (`ctxPct>80`).
  - `loadConfig(raw: unknown): { config: Config; warnings: string[] }` — validates with zod; on any failure returns `defaultConfig` merged with what is salvageable; drops items with unknown `type` (warning) and strips unknown color names from `fg`/`bg` (warning); fills missing fields from defaults; coerces `version` to `1`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/config/validate.test.ts
import { expect, test } from 'vitest';
import { defaultConfig } from './defaults.js';
import { loadConfig } from './validate.js';

test('empty input yields default config, no warnings', () => {
  const { config, warnings } = loadConfig(undefined);
  expect(config).toEqual(defaultConfig);
  expect(warnings).toEqual([]);
});

test('garbage input falls back to default with a warning', () => {
  const { config, warnings } = loadConfig('not an object');
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});

test('unknown widget type is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'bogus' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.lines[0]).toEqual([]);
  expect(warnings.some((w) => w.includes('bogus'))).toBe(true);
});

test('unknown color is stripped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'model', fg: 'fuchsia' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.lines[0]![0]!.fg).toBeUndefined();
  expect(warnings.some((w) => w.includes('fuchsia'))).toBe(true);
});

test('missing surfaces are filled from defaults', () => {
  const { config } = loadConfig({ version: 1, surfaces: { band: { enabled: false, lines: [] } } });
  expect(config.surfaces.statusline).toEqual(defaultConfig.surfaces.statusline);
  expect(config.surfaces.toasts).toEqual(defaultConfig.surfaces.toasts);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- validate`
Expected: FAIL.

- [ ] **Step 3: Implement defaults**

```ts
// packages/core/src/config/defaults.ts
import type { Config } from './types.js';

export const defaultConfig: Config = {
  version: 1,
  theme: 'default',
  themes: {
    default: {
      model: { fg: 'black', bg: 'bgCyan' },
      version: { fg: 'white', bg: 'bgBlue' },
      'context-percentage': { fg: 'black', bg: 'bgBrightYellow' },
      'git-branch': { fg: 'black', bg: 'bgCyan' },
      'git-changes': { fg: 'white', bg: 'bgBrightBlack' },
    },
  },
  defaults: { separator: 'powerline', padding: 1, align: 'left' },
  surfaces: {
    band: {
      enabled: true,
      lines: [
        [
          { id: 'd-version', type: 'version' },
          { id: 'd-model', type: 'model' },
          { id: 'd-ctx', type: 'context-length' },
          { id: 'd-ctxp', type: 'context-percentage' },
        ],
      ],
    },
    statusline: { enabled: false, lines: [[]] },
    pane: { enabled: false, lines: [[]] },
    toasts: {
      enabled: true,
      rules: [{ when: 'ctxPct>80', text: 'Context over 80%', once: true }],
    },
  },
};
```

- [ ] **Step 4: Implement the zod schema**

```ts
// packages/core/src/config/schema.ts
import { z } from 'zod';

const align = z.enum(['left', 'center', 'right']);
const sep = z.enum(['powerline', 'space', 'none']);

// Colors validated in validate.ts (so an unknown color is a warning, not a hard error).
export const itemSchema = z.object({
  id: z.string(),
  type: z.string(),
  fg: z.string().optional(),
  bg: z.string().optional(),
  merge: z.boolean().optional(),
  align: align.optional(),
  rawValue: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const surfaceLayoutSchema = z.object({
  enabled: z.boolean(),
  lines: z.array(z.array(itemSchema)),
});

export const toastRuleSchema = z.object({
  when: z.string(),
  text: z.string(),
  once: z.boolean().optional(),
});

export const configSchema = z.object({
  version: z.literal(1).catch(1),
  theme: z.string().default('default'),
  themes: z
    .record(z.record(z.object({ fg: z.string().optional(), bg: z.string().optional() })))
    .default({}),
  defaults: z.object({ separator: sep, padding: z.number(), align }).partial().default({}),
  surfaces: z
    .object({
      band: surfaceLayoutSchema.optional(),
      statusline: surfaceLayoutSchema.optional(),
      pane: surfaceLayoutSchema.optional(),
      toasts: z.object({ enabled: z.boolean(), rules: z.array(toastRuleSchema) }).optional(),
    })
    .default({}),
});
```

- [ ] **Step 5: Implement `loadConfig`**

```ts
// packages/core/src/config/validate.ts
import { isColor } from '../colors.js';
import type { Config, Item, WidgetType } from './types.js';
import { defaultConfig } from './defaults.js';
import { configSchema } from './schema.js';

const WIDGET_TYPES = new Set<WidgetType>([
  'model',
  'version',
  'context-length',
  'context-percentage',
  'tokens-input',
  'tokens-output',
  'tokens-cached',
  'tokens-total',
  'session-clock',
  'cwd',
  'git-branch',
  'git-changes',
  'git-worktree',
  'git-root-dir',
  'cost',
  'rate-limit-5h',
  'rate-limit-week',
  'block-timer',
  'custom-text',
  'custom-command',
  'flex-separator',
]);

function cleanItem(
  raw: { type: string; fg?: string; bg?: string } & Record<string, unknown>,
  warn: (s: string) => void
): Item | null {
  if (!WIDGET_TYPES.has(raw.type as WidgetType)) {
    warn(`dropped item with unknown type "${raw.type}"`);
    return null;
  }
  const item = { ...raw, type: raw.type as WidgetType } as Item;
  for (const key of ['fg', 'bg'] as const) {
    if (item[key] !== undefined && !isColor(item[key])) {
      warn(`stripped unknown color "${item[key]}" on a ${item.type} item`);
      item[key] = undefined;
    }
  }
  return item;
}

export function loadConfig(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (s: string) => warnings.push(s);

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw !== undefined)
      warn(`config invalid (${parsed.error.issues[0]?.message ?? 'unknown'}); using defaults`);
    return { config: structuredClone(defaultConfig), warnings };
  }
  const p = parsed.data;

  const surf = (name: 'band' | 'statusline' | 'pane') => {
    const s = p.surfaces[name];
    if (!s) return structuredClone(defaultConfig.surfaces[name]);
    return {
      enabled: s.enabled,
      lines: s.lines.map((line) =>
        line.map((it) => cleanItem(it, warn)).filter((x): x is Item => x !== null)
      ),
    };
  };

  const config: Config = {
    version: 1,
    theme: p.theme,
    themes: Object.keys(p.themes).length ? p.themes : structuredClone(defaultConfig.themes),
    defaults: { ...defaultConfig.defaults, ...p.defaults },
    surfaces: {
      band: surf('band'),
      statusline: surf('statusline'),
      pane: surf('pane'),
      toasts: p.surfaces.toasts ?? structuredClone(defaultConfig.surfaces.toasts),
    },
  };
  return { config, warnings };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- validate`
Expected: PASS (all 5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config
git commit -m "feat(core): add config defaults, zod schema, and loadConfig with migration/warnings"
```

---

### Task 5: Widget registry + data widgets

**Files:**

- Create: `packages/core/src/widgets/types.ts`, `packages/core/src/widgets/registry.ts`, `packages/core/src/widgets/data-widgets.ts`
- Test: `packages/core/src/widgets/data-widgets.test.ts`

**Interfaces:**

- Consumes: `Snapshot`, `Item`, `WidgetType`, `fmtNum`, `pct`, `fmtDur`.
- Produces:
  - `WidgetContext = { snapshot: Snapshot; item: Item; commandOutputs: Record<string, string> }`.
  - `WidgetDef = { type: WidgetType; label: string; format: (ctx: WidgetContext) => string | null }`.
  - `registry: Partial<Record<WidgetType, WidgetDef>>` (a mutable map other widget tasks extend) and `register(def: WidgetDef): void`.
  - `dataWidgets` registered: `model, version, context-length, context-percentage, tokens-input, tokens-output, tokens-cached, tokens-total, session-clock, cwd`.
- Labeled vs raw: when `item.rawValue` is true, `format` returns the bare value; otherwise the label-prefixed form shown in tests.

- [ ] **Step 1: Write a sample-snapshot test helper and failing tests**

```ts
// packages/core/src/widgets/data-widgets.test.ts
import { expect, test } from 'vitest';
import type { Snapshot } from '../snapshot.js';
import type { Item } from '../config/types.js';
import { registry } from './registry.js';
import './data-widgets.js'; // registers them

const snap: Snapshot = {
  version: '2.1.0',
  model: 'Opus 4.8',
  effort: 'high',
  cwd: '/home/u/app',
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
  cost: 0.12,
  fivePct: 30,
  fiveReset: null,
  weekPct: 10,
  weekReset: null,
  blockReset: null,
  terminalWidth: 120,
  now: 65000,
};
const item = (type: Item['type'], extra: Partial<Item> = {}): Item => ({ id: 'x', type, ...extra });
const fmt = (type: Item['type'], extra: Partial<Item> = {}) =>
  registry[type]!.format({ snapshot: snap, item: item(type, extra), commandOutputs: {} });

test('model', () => {
  expect(fmt('model')).toBe('Opus 4.8');
});
test('version labeled vs raw', () => {
  expect(fmt('version')).toBe('v2.1.0');
  expect(fmt('version', { rawValue: true })).toBe('2.1.0');
});
test('context-length and percentage', () => {
  expect(fmt('context-length')).toBe('Ctx: 42k');
  expect(fmt('context-percentage')).toBe('Ctx Used: 21%');
});
test('tokens', () => {
  expect(fmt('tokens-input')).toBe('In: 2k');
  expect(fmt('tokens-cached')).toBe('Cached: 1k');
  expect(fmt('tokens-total')).toBe('Total: 3.5k');
});
test('session-clock', () => {
  expect(fmt('session-clock')).toBe('Session: 1m 5s');
});
test('cwd basename', () => {
  expect(fmt('cwd')).toBe('app');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- data-widgets`
Expected: FAIL.

- [ ] **Step 3: Implement widget types + registry**

```ts
// packages/core/src/widgets/types.ts
import type { Snapshot } from '../snapshot.js';
import type { Item, WidgetType } from '../config/types.js';

export type WidgetContext = {
  snapshot: Snapshot;
  item: Item;
  commandOutputs: Record<string, string>;
};
export type WidgetDef = {
  type: WidgetType;
  label: string;
  format: (ctx: WidgetContext) => string | null;
};
```

```ts
// packages/core/src/widgets/registry.ts
import type { WidgetType } from '../config/types.js';
import type { WidgetDef } from './types.js';

export const registry: Partial<Record<WidgetType, WidgetDef>> = {};
export function register(def: WidgetDef): void {
  registry[def.type] = def;
}
```

- [ ] **Step 4: Implement data widgets**

```ts
// packages/core/src/widgets/data-widgets.ts
import { fmtDur, fmtNum, pct } from '../format.js';
import { register } from './registry.js';
import type { WidgetContext } from './types.js';

const labeled = (raw: boolean | undefined, label: string, value: string) =>
  raw ? value : `${label}: ${value}`;

register({ type: 'model', label: 'Model', format: ({ snapshot }) => snapshot.model || null });
register({
  type: 'version',
  label: 'Version',
  format: ({ snapshot, item }) =>
    snapshot.version ? (item.rawValue ? snapshot.version : `v${snapshot.version}`) : null,
});
register({
  type: 'context-length',
  label: 'Ctx',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'Ctx', fmtNum(snapshot.ctxTokens)),
});
register({
  type: 'context-percentage',
  label: 'Ctx Used',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'Ctx Used', pct(snapshot.ctxPct)),
});
register({
  type: 'tokens-input',
  label: 'In',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'In', fmtNum(snapshot.input)),
});
register({
  type: 'tokens-output',
  label: 'Out',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'Out', fmtNum(snapshot.output)),
});
register({
  type: 'tokens-cached',
  label: 'Cached',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'Cached', fmtNum(snapshot.cached)),
});
register({
  type: 'tokens-total',
  label: 'Total',
  format: ({ snapshot, item }) => labeled(item.rawValue, 'Total', fmtNum(snapshot.total)),
});
register({
  type: 'session-clock',
  label: 'Session',
  format: ({ snapshot, item }) =>
    labeled(item.rawValue, 'Session', fmtDur(snapshot.now - snapshot.startedAt)),
});
register({
  type: 'cwd',
  label: 'cwd',
  format: ({ snapshot }: WidgetContext) => {
    if (!snapshot.cwd) return null;
    const parts = snapshot.cwd.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? snapshot.cwd;
  },
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- data-widgets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/widgets/types.ts packages/core/src/widgets/registry.ts packages/core/src/widgets/data-widgets.ts packages/core/src/widgets/data-widgets.test.ts
git commit -m "feat(core): add widget registry and data widgets"
```

---

### Task 6: Git widgets

**Files:**

- Create: `packages/core/src/widgets/git-widgets.ts`
- Test: `packages/core/src/widgets/git-widgets.test.ts`

**Interfaces:**

- Consumes: `register`, `WidgetContext`.
- Produces registered: `git-branch`, `git-changes`, `git-root-dir`, `git-worktree`. All return `null` when `snapshot.repo === false`. `git-worktree` also returns `null` when `snapshot.gitWorktree` is empty.
- Formats (non-raw): branch `✎ main`; changes `(+1 ~2 -0)`; root-dir `⌂ app`; worktree `⎇ wt`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/widgets/git-widgets.test.ts
import { expect, test } from 'vitest';
import type { Snapshot } from '../snapshot.js';
import type { Item } from '../config/types.js';
import { registry } from './registry.js';
import './git-widgets.js';

const base: Snapshot = {
  version: '',
  model: '',
  effort: null,
  cwd: '',
  repo: true,
  gitRoot: 'app',
  gitBranch: 'main',
  gitWorktree: 'wt',
  added: 1,
  modified: 2,
  deleted: 0,
  ctxTokens: 0,
  ctxPct: 0,
  cached: 0,
  input: 0,
  output: 0,
  total: 0,
  startedAt: 0,
  cost: null,
  fivePct: null,
  fiveReset: null,
  weekPct: null,
  weekReset: null,
  blockReset: null,
  terminalWidth: 80,
  now: 0,
};
const fmt = (type: Item['type'], snapshot: Snapshot) =>
  registry[type]!.format({ snapshot, item: { id: 'x', type }, commandOutputs: {} });

test('git widgets render when in a repo', () => {
  expect(fmt('git-branch', base)).toBe('✎ main');
  expect(fmt('git-changes', base)).toBe('(+1 ~2 -0)');
  expect(fmt('git-root-dir', base)).toBe('⌂ app');
  expect(fmt('git-worktree', base)).toBe('⎇ wt');
});

test('git widgets omit when not in a repo', () => {
  const noRepo = { ...base, repo: false };
  for (const t of ['git-branch', 'git-changes', 'git-root-dir', 'git-worktree'] as const) {
    expect(fmt(t, noRepo)).toBeNull();
  }
});

test('worktree omits when empty', () => {
  expect(fmt('git-worktree', { ...base, gitWorktree: '' })).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- git-widgets`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/widgets/git-widgets.ts
import { register } from './registry.js';

register({
  type: 'git-branch',
  label: 'Branch',
  format: ({ snapshot }) => (snapshot.repo ? `✎ ${snapshot.gitBranch || '?'}` : null),
});
register({
  type: 'git-root-dir',
  label: 'Git root',
  format: ({ snapshot }) => (snapshot.repo ? `⌂ ${snapshot.gitRoot || '?'}` : null),
});
register({
  type: 'git-changes',
  label: 'Changes',
  format: ({ snapshot }) =>
    snapshot.repo ? `(+${snapshot.added} ~${snapshot.modified} -${snapshot.deleted})` : null,
});
register({
  type: 'git-worktree',
  label: 'Worktree',
  format: ({ snapshot }) =>
    snapshot.repo && snapshot.gitWorktree ? `⎇ ${snapshot.gitWorktree}` : null,
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- git-widgets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/widgets/git-widgets.ts packages/core/src/widgets/git-widgets.test.ts
git commit -m "feat(core): add git widgets"
```

---

### Task 7: Usage & cost widgets

**Files:**

- Create: `packages/core/src/widgets/usage-widgets.ts`
- Test: `packages/core/src/widgets/usage-widgets.test.ts`

**Interfaces:**

- Consumes: `register`, `fmtDur`, `pct`, `bar`.
- Produces registered: `cost`, `rate-limit-5h`, `rate-limit-week`, `block-timer`.
  - `cost`: `null` when `snapshot.cost === null`; else `$0.12` (2 decimals).
  - `rate-limit-5h`: when `fivePct === null` → `Session: —`; else `Session: <bar> 30%` and, when `fiveReset` is a parseable ISO in the future, append `  <fmtDur(reset-now)>`.
  - `rate-limit-week`: when `weekPct === null` → `Weekly: —`; else `Weekly: 10%` (+ reset like above from `weekReset`).
  - `block-timer`: when `blockReset === null` → `null`; else `Block: <fmtDur(reset-now)>`.
- Reset math uses `Date.parse`; a NaN or past time omits the countdown portion (no negative durations).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/widgets/usage-widgets.test.ts
import { expect, test } from 'vitest';
import type { Snapshot } from '../snapshot.js';
import type { Item } from '../config/types.js';
import { registry } from './registry.js';
import './usage-widgets.js';

const now = 1_000_000;
const base: Snapshot = {
  version: '',
  model: '',
  effort: null,
  cwd: '',
  repo: false,
  gitRoot: '',
  gitBranch: '',
  gitWorktree: '',
  added: 0,
  modified: 0,
  deleted: 0,
  ctxTokens: 0,
  ctxPct: 0,
  cached: 0,
  input: 0,
  output: 0,
  total: 0,
  startedAt: 0,
  cost: 0.12,
  fivePct: 30,
  fiveReset: new Date(now + 3_720_000).toISOString(),
  weekPct: 10,
  weekReset: null,
  blockReset: null,
  terminalWidth: 80,
  now,
};
const fmt = (type: Item['type'], snapshot: Snapshot) =>
  registry[type]!.format({ snapshot, item: { id: 'x', type }, commandOutputs: {} });

test('cost', () => {
  expect(fmt('cost', base)).toBe('$0.12');
  expect(fmt('cost', { ...base, cost: null })).toBeNull();
});
test('rate-limit-5h with reset', () => {
  expect(fmt('rate-limit-5h', base)).toBe('Session: █░░░░ 30%  1h 2m');
});
test('rate-limit-5h missing', () => {
  expect(fmt('rate-limit-5h', { ...base, fivePct: null })).toBe('Session: —');
});
test('rate-limit-week without reset', () => {
  expect(fmt('rate-limit-week', base)).toBe('Weekly: 10%');
});
test('block-timer missing', () => {
  expect(fmt('block-timer', base)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- usage-widgets`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/widgets/usage-widgets.ts
import { bar, fmtDur, pct } from '../format.js';
import { register } from './registry.js';

function until(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = t - now;
  return d > 0 ? d : null;
}

register({
  type: 'cost',
  label: 'Cost',
  format: ({ snapshot }) => (snapshot.cost === null ? null : `$${snapshot.cost.toFixed(2)}`),
});

register({
  type: 'rate-limit-5h',
  label: 'Session limit',
  format: ({ snapshot }) => {
    if (snapshot.fivePct === null) return 'Session: —';
    const reset = until(snapshot.fiveReset, snapshot.now);
    return `Session: ${bar(snapshot.fivePct)} ${pct(snapshot.fivePct)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
  },
});

register({
  type: 'rate-limit-week',
  label: 'Weekly limit',
  format: ({ snapshot }) => {
    if (snapshot.weekPct === null) return 'Weekly: —';
    const reset = until(snapshot.weekReset, snapshot.now);
    return `Weekly: ${pct(snapshot.weekPct)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
  },
});

register({
  type: 'block-timer',
  label: 'Block',
  format: ({ snapshot }) => {
    const reset = until(snapshot.blockReset, snapshot.now);
    return reset === null ? null : `Block: ${fmtDur(reset)}`;
  },
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- usage-widgets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/widgets/usage-widgets.ts packages/core/src/widgets/usage-widgets.test.ts
git commit -m "feat(core): add cost and usage-limit widgets"
```

---

### Task 8: Custom widgets (text, command, flex)

**Files:**

- Create: `packages/core/src/widgets/custom-widgets.ts`
- Test: `packages/core/src/widgets/custom-widgets.test.ts`

**Interfaces:**

- Consumes: `register`, `WidgetContext`.
- Produces registered: `custom-text`, `custom-command`, `flex-separator`.
  - `custom-text`: returns `String(item.metadata?.text ?? '')`; returns `null` when empty.
  - `custom-command`: returns `ctx.commandOutputs[item.id]` trimmed; `null` when absent/empty. (The mod runs the shell command and supplies the output; core never executes anything.)
  - `flex-separator`: returns `''` (its presence is what matters; layout treats it specially via the `flex` cell flag). Registered so the TUI can list it.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/widgets/custom-widgets.test.ts
import { expect, test } from 'vitest';
import type { Snapshot } from '../snapshot.js';
import type { Item } from '../config/types.js';
import { registry } from './registry.js';
import './custom-widgets.js';

const snap = { terminalWidth: 80, now: 0 } as unknown as Snapshot;
const ctx = (item: Item, commandOutputs: Record<string, string> = {}) => ({
  snapshot: snap,
  item,
  commandOutputs,
});

test('custom-text', () => {
  expect(
    registry['custom-text']!.format(ctx({ id: 'a', type: 'custom-text', metadata: { text: 'hi' } }))
  ).toBe('hi');
  expect(registry['custom-text']!.format(ctx({ id: 'a', type: 'custom-text' }))).toBeNull();
});
test('custom-command reads host output', () => {
  const item: Item = { id: 'cc', type: 'custom-command', metadata: { command: 'whoami' } };
  expect(registry['custom-command']!.format(ctx(item, { cc: 'sushant\n' }))).toBe('sushant');
  expect(registry['custom-command']!.format(ctx(item, {}))).toBeNull();
});
test('flex-separator is empty string', () => {
  expect(registry['flex-separator']!.format(ctx({ id: 'f', type: 'flex-separator' }))).toBe('');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- custom-widgets`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/widgets/custom-widgets.ts
import { register } from './registry.js';

register({
  type: 'custom-text',
  label: 'Custom text',
  format: ({ item }) => {
    const text = String(item.metadata?.['text'] ?? '');
    return text.length ? text : null;
  },
});

register({
  type: 'custom-command',
  label: 'Custom command',
  format: ({ item, commandOutputs }) => {
    const out = (commandOutputs[item.id] ?? '').trim();
    return out.length ? out : null;
  },
});

register({ type: 'flex-separator', label: 'Flex separator', format: () => '' });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- custom-widgets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/widgets/custom-widgets.ts packages/core/src/widgets/custom-widgets.test.ts
git commit -m "feat(core): add custom-text, custom-command, flex-separator widgets"
```

---

### Task 9: Theme resolution

**Files:**

- Create: `packages/core/src/theme/themes.ts`
- Test: `packages/core/src/theme/themes.test.ts`

**Interfaces:**

- Consumes: `Config`, `Item`.
- Produces: `resolveColors(item: Item, config: Config): { fg?: string; bg?: string }` — precedence: explicit `item.fg`/`item.bg` > the active theme's entry for `item.type` (`config.themes[config.theme]?.[item.type]`) > undefined. Missing theme name resolves to no theme contribution.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/theme/themes.test.ts
import { expect, test } from 'vitest';
import type { Config, Item } from '../config/types.js';
import { resolveColors } from './themes.js';

const config = {
  theme: 'default',
  themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
} as unknown as Config;

test('theme default applies', () => {
  expect(resolveColors({ id: 'a', type: 'model' }, config)).toEqual({ fg: 'black', bg: 'bgCyan' });
});
test('item override wins', () => {
  expect(resolveColors({ id: 'a', type: 'model', fg: 'white' }, config)).toEqual({
    fg: 'white',
    bg: 'bgCyan',
  });
});
test('no theme entry yields undefined', () => {
  expect(resolveColors({ id: 'a', type: 'version' }, config)).toEqual({
    fg: undefined,
    bg: undefined,
  });
});
test('missing theme name is safe', () => {
  const c = { ...config, theme: 'nope' } as Config;
  expect(resolveColors({ id: 'a', type: 'model' }, c)).toEqual({ fg: undefined, bg: undefined });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- themes`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/theme/themes.ts
import type { Config, Item } from '../config/types.js';

export function resolveColors(item: Item, config: Config): { fg?: string; bg?: string } {
  const themeEntry = config.themes[config.theme]?.[item.type];
  return {
    fg: item.fg ?? themeEntry?.fg,
    bg: item.bg ?? themeEntry?.bg,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- themes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theme
git commit -m "feat(core): add theme color resolution"
```

---

### Task 10: Cells (item → cell)

**Files:**

- Create: `packages/core/src/layout/cells.ts`
- Test: `packages/core/src/layout/cells.test.ts`

**Interfaces:**

- Consumes: `Config`, `Item`, `Snapshot`, `registry`, `resolveColors`.
- Produces:
  - `type Cell = { text: string; fg?: string; bg?: string; merge: boolean; flex: boolean }` — `text` is the padded, non-flex content; `flex: true` only for `flex-separator` (then `text === ''`).
  - `itemToCell(item, config, snapshot, commandOutputs): Cell | null` — returns `null` when the widget `format` returns `null`. Padding = `config.defaults.padding` spaces each side (flex cells get no padding). Colors from `resolveColors`.
  - `lineToCells(items, config, snapshot, commandOutputs): Cell[]` — maps + drops nulls.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/layout/cells.test.ts
import { expect, test } from 'vitest';
import type { Config } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';
import { itemToCell, lineToCells } from './cells.js';
import '../widgets/data-widgets.js';
import '../widgets/git-widgets.js';
import '../widgets/custom-widgets.js';

const config = {
  theme: 'default',
  themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
  defaults: { separator: 'powerline', padding: 1, align: 'left' },
} as unknown as Config;
const snap = { model: 'Opus', repo: false } as unknown as Snapshot;

test('itemToCell pads and colors', () => {
  expect(itemToCell({ id: 'a', type: 'model' }, config, snap, {})).toEqual({
    text: ' Opus ',
    fg: 'black',
    bg: 'bgCyan',
    merge: false,
    flex: false,
  });
});
test('omitted widget yields null', () => {
  expect(itemToCell({ id: 'g', type: 'git-branch' }, config, snap, {})).toBeNull();
});
test('flex cell is unpadded and flagged', () => {
  expect(itemToCell({ id: 'f', type: 'flex-separator' }, config, snap, {})).toEqual({
    text: '',
    fg: undefined,
    bg: undefined,
    merge: false,
    flex: true,
  });
});
test('lineToCells drops nulls', () => {
  const cells = lineToCells(
    [
      { id: 'a', type: 'model' },
      { id: 'g', type: 'git-branch' },
    ],
    config,
    snap,
    {}
  );
  expect(cells).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- cells`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/layout/cells.ts
import type { Config, Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';
import { registry } from '../widgets/registry.js';
import { resolveColors } from '../theme/themes.js';

export type Cell = { text: string; fg?: string; bg?: string; merge: boolean; flex: boolean };

export function itemToCell(
  item: Item,
  config: Config,
  snapshot: Snapshot,
  commandOutputs: Record<string, string>
): Cell | null {
  const def = registry[item.type];
  if (!def) return null;
  const value = def.format({ snapshot, item, commandOutputs });
  if (value === null) return null;

  const flex = item.type === 'flex-separator';
  const pad = flex ? '' : ' '.repeat(config.defaults.padding);
  const { fg, bg } = resolveColors(item, config);
  return { text: flex ? '' : `${pad}${value}${pad}`, fg, bg, merge: item.merge ?? false, flex };
}

export function lineToCells(
  items: Item[],
  config: Config,
  snapshot: Snapshot,
  commandOutputs: Record<string, string>
): Cell[] {
  return items
    .map((it) => itemToCell(it, config, snapshot, commandOutputs))
    .filter((c): c is Cell => c !== null);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- cells`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/cells.ts packages/core/src/layout/cells.test.ts
git commit -m "feat(core): add cell resolution (itemToCell/lineToCells)"
```

---

### Task 11: Compose a line (merge, flex, powerline, truncate)

**Files:**

- Create: `packages/core/src/layout/compose.ts`
- Test: `packages/core/src/layout/compose.test.ts`

**Interfaces:**

- Consumes: `Cell`, `Segment`, `SeparatorMode`.
- Produces: `composeLine(cells: Cell[], mode: SeparatorMode, width: number, glyph = '▒'): Segment[]`.
  - **merge**: a cell with `merge: true` is concatenated onto the previous non-flex cell's text (same bg), no separator between them.
  - **flex**: `flex-separator` cells become `{ kind: 'flex', text: ' '.repeat(k) }` sharing the leftover width (`width - contentWidth`) evenly; when no leftover, width 0; multiple flex cells split the remainder (first cells get the extra when it doesn't divide evenly).
  - **powerline**: between adjacent non-flex cells emit `{ kind: 'separator', text: glyph, fg: prevBg, bg: nextBg }`; prepend a start cap `{ kind: 'cap', text: glyph, fg: firstBg }` and append an end cap `{ kind: 'cap', text: glyph, fg: lastBg }`.
  - **space** mode: a single space between cells, no caps, no color on the gap. **none** mode: cells adjacent.
  - **truncate**: if the composed visible width exceeds `width`, trim trailing content cells' text (never produce negative-length padding) so total visible width ≤ `width`; caps are dropped last. Must never throw for `width` as small as `0`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/layout/compose.test.ts
import { expect, test } from 'vitest';
import type { Cell } from './cells.js';
import { composeLine } from './compose.js';

const cell = (text: string, bg?: string, extra: Partial<Cell> = {}): Cell => ({
  text,
  bg,
  merge: false,
  flex: false,
  ...extra,
});
const visible = (segs: { text: string }[]) => segs.map((s) => s.text).join('').length;

test('powerline inserts separators colored prevBg/nextBg plus caps', () => {
  const segs = composeLine([cell(' a ', 'bgRed'), cell(' b ', 'bgBlue')], 'powerline', 100);
  expect(segs.map((s) => s.kind)).toEqual(['cap', 'cell', 'separator', 'cell', 'cap']);
  const sep = segs[2]!;
  expect(sep).toMatchObject({ text: '▒', fg: 'bgRed', bg: 'bgBlue' });
});

test('space mode joins with single spaces, no caps', () => {
  const segs = composeLine([cell('a'), cell('b')], 'space', 100);
  expect(segs.map((s) => s.text).join('')).toBe('a b');
  expect(segs.some((s) => s.kind === 'cap')).toBe(false);
});

test('merge concatenates onto previous cell with no separator', () => {
  const segs = composeLine(
    [cell(' a ', 'bgRed'), cell('b', 'bgRed', { merge: true })],
    'powerline',
    100
  );
  const cells = segs.filter((s) => s.kind === 'cell');
  expect(cells).toHaveLength(1);
  expect(cells[0]!.text).toBe(' a b');
});

test('flex distributes leftover width', () => {
  const segs = composeLine(
    [cell('ab'), cell('', undefined, { flex: true }), cell('cd')],
    'none',
    10
  );
  const flex = segs.find((s) => s.kind === 'flex')!;
  expect(flex.text).toBe('      '); // 10 - 4 content = 6 spaces
});

test('truncation keeps visible width within bounds and never throws', () => {
  const segs = composeLine([cell(' hello '), cell(' world ')], 'powerline', 6);
  expect(visible(segs)).toBeLessThanOrEqual(6);
  expect(() => composeLine([cell('x')], 'powerline', 0)).not.toThrow();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- compose`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/layout/compose.ts
import type { SeparatorMode } from '../config/types.js';
import type { Segment } from '../render-model.js';
import type { Cell } from './cells.js';

function mergeCells(cells: Cell[]): Cell[] {
  const out: Cell[] = [];
  for (const c of cells) {
    const prev = out[out.length - 1];
    if (c.merge && prev && !prev.flex && !c.flex) {
      prev.text = `${prev.text}${c.text}`;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

export function composeLine(
  cells: Cell[],
  mode: SeparatorMode,
  width: number,
  glyph = '▒'
): Segment[] {
  const merged = mergeCells(cells);
  const content = merged.filter((c) => !c.flex);
  const flexCount = merged.filter((c) => c.flex).length;

  // width taken by content + separators/caps
  const contentWidth = content.reduce((n, c) => n + c.text.length, 0);
  let sepWidth = 0;
  if (mode === 'powerline') sepWidth = Math.max(0, content.length - 1) + (content.length ? 2 : 0);
  else if (mode === 'space') sepWidth = Math.max(0, content.length - 1);
  const leftover = Math.max(0, width - contentWidth - sepWidth);
  const per = flexCount ? Math.floor(leftover / flexCount) : 0;
  let extra = flexCount ? leftover - per * flexCount : 0;
  const flexWidth = (): number => {
    const w = per + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return w;
  };

  const segs: Segment[] = [];
  const emitStartCap = mode === 'powerline' && content.length > 0;
  if (emitStartCap) segs.push({ kind: 'cap', text: glyph, fg: content[0]!.bg });

  let ci = 0;
  for (const c of merged) {
    if (c.flex) {
      segs.push({ kind: 'flex', text: ' '.repeat(flexWidth()) });
      continue;
    }
    segs.push({ kind: 'cell', text: c.text, fg: c.fg, bg: c.bg });
    const isLast = ci === content.length - 1;
    if (!isLast) {
      const next = content[ci + 1]!;
      if (mode === 'powerline')
        segs.push({ kind: 'separator', text: glyph, fg: c.bg, bg: next.bg });
      else if (mode === 'space') segs.push({ kind: 'separator', text: ' ' });
    }
    ci += 1;
  }
  if (emitStartCap) segs.push({ kind: 'cap', text: glyph, fg: content[content.length - 1]!.bg });

  return truncate(segs, width);
}

function truncate(segs: Segment[], width: number): Segment[] {
  const total = segs.reduce((n, s) => n + s.text.length, 0);
  if (total <= width) return segs;
  let budget = width;
  const out: Segment[] = [];
  for (const s of segs) {
    if (s.kind === 'cap') continue; // drop caps first under pressure
    if (budget <= 0) break;
    if (s.text.length <= budget) {
      out.push(s);
      budget -= s.text.length;
    } else {
      out.push({ ...s, text: s.text.slice(0, budget) });
      budget = 0;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- compose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/compose.ts packages/core/src/layout/compose.test.ts
git commit -m "feat(core): add line composition (merge/flex/powerline/truncate)"
```

---

### Task 12: `render()` — config + snapshot → RenderModel

**Files:**

- Create: `packages/core/src/render.ts`
- Test: `packages/core/src/render.test.ts`

**Interfaces:**

- Consumes: `Config`, `Snapshot`, `RenderModel`, `lineToCells`, `composeLine`.
- Produces:
  - `type RenderOptions = { surface: 'band' | 'statusline' | 'pane'; width: number; commandOutputs?: Record<string, string> }`.
  - `render(config, snapshot, opts): RenderModel` — reads `config.surfaces[opts.surface]`; if `!enabled` returns `{ lines: [] }`; otherwise composes each config line (dropping lines that resolve to zero cells) into a `RenderLine` using `config.defaults.separator` and `opts.width`.
- Ensures the import side-effect of registering all widgets happens (import the four widget modules here).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/render.test.ts
import { expect, test } from 'vitest';
import { defaultConfig } from './config/defaults.js';
import type { Snapshot } from './snapshot.js';
import { render } from './render.js';

const snap: Snapshot = {
  version: '2.1.0',
  model: 'Opus',
  effort: null,
  cwd: '/x/app',
  repo: false,
  gitRoot: '',
  gitBranch: '',
  gitWorktree: '',
  added: 0,
  modified: 0,
  deleted: 0,
  ctxTokens: 42000,
  ctxPct: 21,
  cached: 0,
  input: 0,
  output: 0,
  total: 0,
  startedAt: 0,
  cost: null,
  fivePct: null,
  fiveReset: null,
  weekPct: null,
  weekReset: null,
  blockReset: null,
  terminalWidth: 120,
  now: 0,
};

test('band renders the default line', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 120 });
  expect(model.lines).toHaveLength(1);
  const text = model.lines[0]!.segments.map((s) => s.text).join('');
  expect(text).toContain('v2.1.0');
  expect(text).toContain('Opus');
  expect(text).toContain('Ctx: 42k');
});

test('disabled surface renders nothing', () => {
  const model = render(defaultConfig, snap, { surface: 'statusline', width: 120 });
  expect(model.lines).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- render`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/render.ts
import type { Config } from './config/types.js';
import type { RenderModel } from './render-model.js';
import type { Snapshot } from './snapshot.js';
import { lineToCells } from './layout/cells.js';
import { composeLine } from './layout/compose.js';

// Register all widgets (side-effect imports).
import './widgets/data-widgets.js';
import './widgets/git-widgets.js';
import './widgets/usage-widgets.js';
import './widgets/custom-widgets.js';

export type RenderOptions = {
  surface: 'band' | 'statusline' | 'pane';
  width: number;
  commandOutputs?: Record<string, string>;
};

export function render(config: Config, snapshot: Snapshot, opts: RenderOptions): RenderModel {
  const surface = config.surfaces[opts.surface];
  if (!surface.enabled) return { lines: [] };
  const outputs = opts.commandOutputs ?? {};

  const lines = surface.lines
    .map((items) => lineToCells(items, config, snapshot, outputs))
    .filter((cells) => cells.length > 0)
    .map((cells) => ({ segments: composeLine(cells, config.defaults.separator, opts.width) }));

  return { lines };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render.ts packages/core/src/render.test.ts
git commit -m "feat(core): add render() orchestration"
```

---

### Task 13: `toAnsi()` — RenderModel → ANSI string

**Files:**

- Create: `packages/core/src/ansi.ts`
- Test: `packages/core/src/ansi.test.ts`

**Interfaces:**

- Consumes: `RenderModel`, `Segment`.
- Produces: `toAnsi(model: RenderModel): string` — joins each line's segment texts wrapped in SGR codes for the named `fg`/`bg`, resetting (`\x1b[0m`) after each segment; lines joined by `\n`. Unknown/absent colors emit no code. Used by the mod for the native status line surface.
- Internal: a name→SGR-code map covering the color vocabulary from Task 3.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/ansi.test.ts
import { expect, test } from 'vitest';
import { toAnsi } from './ansi.js';

test('wraps colored segments and resets', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: 'red', bg: 'bgBlue' }] }],
  });
  expect(out).toBe('\x1b[31m\x1b[44mhi\x1b[0m');
});
test('uncolored segment is plain', () => {
  expect(toAnsi({ lines: [{ segments: [{ kind: 'cell', text: 'x' }] }] })).toBe('x');
});
test('multiple lines joined by newline', () => {
  const out = toAnsi({
    lines: [
      { segments: [{ kind: 'cell', text: 'a' }] },
      { segments: [{ kind: 'cell', text: 'b' }] },
    ],
  });
  expect(out).toBe('a\nb');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- ansi`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/ansi.ts
import type { RenderModel, Segment } from './render-model.js';

const FG: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightBlack: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
  brightGray: 97,
};
const BG: Record<string, number> = {
  bgBlack: 40,
  bgRed: 41,
  bgGreen: 42,
  bgYellow: 43,
  bgBlue: 44,
  bgMagenta: 45,
  bgCyan: 46,
  bgWhite: 47,
  bgGray: 100,
  bgBrightBlack: 100,
  bgBrightRed: 101,
  bgBrightGreen: 102,
  bgBrightYellow: 103,
  bgBrightBlue: 104,
  bgBrightMagenta: 105,
  bgBrightCyan: 106,
  bgBrightWhite: 107,
  bgBrightGray: 107,
};

function sgr(seg: Segment): string {
  const codes: string[] = [];
  if (seg.fg && FG[seg.fg] !== undefined) codes.push(`\x1b[${FG[seg.fg]}m`);
  if (seg.bg && BG[seg.bg] !== undefined) codes.push(`\x1b[${BG[seg.bg]}m`);
  if (!codes.length) return seg.text;
  return `${codes.join('')}${seg.text}\x1b[0m`;
}

export function toAnsi(model: RenderModel): string {
  return model.lines.map((line) => line.segments.map(sgr).join('')).join('\n');
}
```

Note: a powerline separator carries `fg` as a `bg*` name (it draws a bg-colored glyph as foreground). For the ANSI string surface this task renders separators best-effort; the mod's richer painters handle powerline faithfully. Keep this behavior — the statusline surface is documented as limited.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- ansi`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ansi.ts packages/core/src/ansi.test.ts
git commit -m "feat(core): add RenderModel -> ANSI serialization"
```

---

### Task 14: Import an existing ccstatusline config

**Files:**

- Create: `packages/core/src/config/import-ccstatusline.ts`
- Test: `packages/core/src/config/import-ccstatusline.test.ts`

**Interfaces:**

- Consumes: `loadConfig`, `Config`, `WidgetType`.
- Produces: `importCcstatusline(raw: unknown): { config: Config; warnings: string[] }`.
  - ccstatusline shape: `{ version, lines: Item[][] }` with item `{ id, type, backgroundColor?, rawValue?, merge?, metadata? }`.
  - Map each ccstatusline item `type` to a `ccstatus` `WidgetType` via a lookup table; unmapped types are dropped with a warning. Map `backgroundColor` → `bg` (validated downstream by `loadConfig`). Put the mapped `lines` under `surfaces.band`, enabled, then run the result through `loadConfig` so the output is always a valid `Config`.
  - Type map (verbatim): `version→version, model→model, thinking-effort→model (merge note), context-length→context-length, context-percentage→context-percentage, tokens-cached→tokens-cached, tokens-input→tokens-input, tokens-output→tokens-output, tokens-total→tokens-total, git-root-dir→git-root-dir, git-branch→git-branch, git-worktree→git-worktree, git-changes→git-changes, session-clock→session-clock`. (Others dropped with a warning in v1.)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/config/import-ccstatusline.test.ts
import { expect, test } from 'vitest';
import { importCcstatusline } from './import-ccstatusline.js';

const ccsl = {
  version: 4,
  lines: [
    [
      { id: '1', type: 'version' },
      { id: '2', type: 'context-percentage', backgroundColor: 'bgBrightYellow' },
      { id: '3', type: 'totally-unknown' },
    ],
  ],
};

test('maps known items into the band surface', () => {
  const { config, warnings } = importCcstatusline(ccsl);
  const line = config.surfaces.band.lines[0]!;
  expect(line.map((i) => i.type)).toEqual(['version', 'context-percentage']);
  expect(line[1]!.bg).toBe('bgBrightYellow');
  expect(config.surfaces.band.enabled).toBe(true);
  expect(warnings.some((w) => w.includes('totally-unknown'))).toBe(true);
});

test('garbage input yields a valid default config with a warning', () => {
  const { config, warnings } = importCcstatusline(42);
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- import-ccstatusline`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/config/import-ccstatusline.ts
import type { Config, Item, WidgetType } from './types.js';
import { loadConfig } from './validate.js';
import { defaultConfig } from './defaults.js';

const TYPE_MAP: Record<string, WidgetType> = {
  version: 'version',
  model: 'model',
  'thinking-effort': 'model',
  'context-length': 'context-length',
  'context-percentage': 'context-percentage',
  'tokens-cached': 'tokens-cached',
  'tokens-input': 'tokens-input',
  'tokens-output': 'tokens-output',
  'tokens-total': 'tokens-total',
  'git-root-dir': 'git-root-dir',
  'git-branch': 'git-branch',
  'git-worktree': 'git-worktree',
  'git-changes': 'git-changes',
  'session-clock': 'session-clock',
};

export function importCcstatusline(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { lines?: unknown }).lines)) {
    warnings.push('input is not a ccstatusline config; using defaults');
    return { config: structuredClone(defaultConfig), warnings };
  }
  const lines = (raw as { lines: unknown[][] }).lines.map((line) =>
    (Array.isArray(line) ? line : []).flatMap((raw: Record<string, unknown>): Item[] => {
      const srcType = String(raw['type']);
      const type = TYPE_MAP[srcType];
      if (!type) {
        warnings.push(`dropped unmapped ccstatusline item "${srcType}"`);
        return [];
      }
      const item: Item = {
        id: String(raw['id'] ?? `${type}-${Math.random().toString(36).slice(2)}`),
        type,
        bg: typeof raw['backgroundColor'] === 'string' ? raw['backgroundColor'] : undefined,
        rawValue: raw['rawValue'] === true || undefined,
        merge: raw['merge'] === true || undefined,
      };
      return [item];
    })
  );
  const draft = { version: 1, surfaces: { band: { enabled: true, lines } } };
  const loaded = loadConfig(draft);
  return { config: loaded.config, warnings: [...warnings, ...loaded.warnings] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @ccstatus/core -- import-ccstatusline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/import-ccstatusline.ts packages/core/src/config/import-ccstatusline.test.ts
git commit -m "feat(core): import existing ccstatusline configs"
```

---

### Task 15: Public API surface (`index.ts`) + full build gate

**Files:**

- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

**Interfaces:**

- Produces the package's public exports: `render`, `toAnsi`, `loadConfig`, `defaultConfig`, `importCcstatusline`, `registry`, `isColor`, `COLORS`, and all public types (`Config`, `Item`, `WidgetType`, `Snapshot`, `RenderModel`, `Segment`, `RenderOptions`, `WidgetDef`, `WidgetContext`, `Theme`, `Defaults`, `SurfaceLayout`, `ToastRule`, `ToastSurface`, `Align`, `SeparatorMode`).

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/index.test.ts
import { expect, test } from 'vitest';
import * as core from './index.js';
import { defaultConfig } from './index.js';

test('public API is exported', () => {
  for (const name of [
    'render',
    'toAnsi',
    'loadConfig',
    'defaultConfig',
    'importCcstatusline',
    'registry',
    'isColor',
    'COLORS',
  ]) {
    expect(core).toHaveProperty(name);
  }
});

test('end-to-end: default config renders a band to ANSI', () => {
  const model = core.render(
    defaultConfig,
    {
      version: '1.0.0',
      model: 'M',
      effort: null,
      cwd: '/a/b',
      repo: false,
      gitRoot: '',
      gitBranch: '',
      gitWorktree: '',
      added: 0,
      modified: 0,
      deleted: 0,
      ctxTokens: 1000,
      ctxPct: 5,
      cached: 0,
      input: 0,
      output: 0,
      total: 0,
      startedAt: 0,
      cost: null,
      fivePct: null,
      fiveReset: null,
      weekPct: null,
      weekReset: null,
      blockReset: null,
      terminalWidth: 100,
      now: 0,
    },
    { surface: 'band', width: 100 }
  );
  expect(core.toAnsi(model)).toContain('v1.0.0');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ccstatus/core -- index`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/index.ts
export { render } from './render.js';
export type { RenderOptions } from './render.js';
export { toAnsi } from './ansi.js';
export { loadConfig } from './config/validate.js';
export { defaultConfig } from './config/defaults.js';
export { importCcstatusline } from './config/import-ccstatusline.js';
export { registry, register } from './widgets/registry.js';
export { isColor, COLORS } from './colors.js';

export type { Snapshot } from './snapshot.js';
export type { Segment, SegmentKind, RenderLine, RenderModel } from './render-model.js';
export type {
  Align,
  SeparatorMode,
  WidgetType,
  Item,
  SurfaceLayout,
  ToastRule,
  ToastSurface,
  Theme,
  Defaults,
  Config,
} from './config/types.js';
export type { WidgetContext, WidgetDef } from './widgets/types.js';
```

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm test -w @ccstatus/core && npm run typecheck -w @ccstatus/core`
Expected: ALL tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): expose public API and end-to-end render test"
```

---

## Deferred within core (carried, not yet rendered)

- **Alignment** (`defaults.align` and per-item `align`) is retained in the config
  types and schema so the TUI can set it and configs round-trip, but the v1
  renderer does **not** apply it — meaningful per-item alignment needs
  fixed-width columns, which are out of scope for v1. Positioning is achieved
  with `flex-separator`. A later plan adds column-width layout and wires `align`
  into `composeLine`.
- **Toast `when` evaluation** (e.g. `ctxPct>80`) is pure logic but lives with the
  mod (Plan 2), since only the mod fires toasts; it will be a small, separately
  tested helper. The config schema already validates and stores toast rules here.

## What's next (separate plans, written after core lands)

- **Plan 2 — Plugin (mod):** `plugin/` with `collect.ts` (Snapshot from `$.session` + git via `$.process`, seeded from `ccstatusline-band`), `config-io.ts` (read `~/.config/ccstatus/config.json` via `$.fs` with mtime-based reload), `paint.tsx` (RenderModel → `$.ui.resolve` elements for band/pane), native status line via `toAnsi` + `$.ui.status`, toast-rule evaluation, `/ccstatus` command, the core-sync step into `plugin/hooks/core/`, and `claude plugin test` coverage across `['terminal','desktop']`. Its Interfaces blocks will cite the exact signatures finalized in this plan.
- **Plan 3 — TUI:** `packages/tui` Ink app — config load/save (atomic + backup), live preview via `render` + a sample snapshot, editor screens (items/colors/themes/powerline/surfaces/defaults), and ccstatusline import. The visual companion can be offered here for screen mockups.
- **Plan 4 — Packaging:** `.claude-plugin/marketplace.json`, npm publish config for the TUI bin, README + demo gif, LICENSE, CI.
