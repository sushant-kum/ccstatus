# 256-Color Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ccstatus's 16 named colors with the 256-color palette (indices 16–255) for both the mod and native status line, fixing status-line dimming and unifying rendering.

**Architecture:** A color becomes an integer `16–255` (xterm-256 cube + grayscale; 0–15 rejected because Claude Code dims them in the status line). One `indexToRgb` table feeds both painters — `toAnsi` emits `ESC[38;5;Nm`/`ESC[48;5;Nm`, Ink gets `#rrggbb` — so mod and status line render identical colors. Auto-contrast becomes luminance-based. The positional-palette model (DEC-0020/0021) is unchanged; only the color _value type_ changes from `string` to `number`.

**Tech Stack:** TypeScript (strict), zod, vitest, Ink, tsup.

**Spec:** `docs/superpowers/specs/2026-10-13-256-color-palette-design.md`

## Global Constraints

- Colors are integers **16–255** only; **0–15 are rejected** (they dim in the status line).
- `loadConfig` **never throws** — invalid colors warn + drop/migrate.
- Strict TS: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `NodeNext`, `.js` import extensions; **no `any`, no non-null `!`**; every function has JSDoc (descriptions, no `{type}` tags) and an explicit return type. Module-level const-arrow helpers are JSDoc-exempt but typed.
- **No AI attribution** in commits/PRs (DEC-0007): no `Co-Authored-By`, no "Generated with", no session links.
- Conventional Commits.
- `plugin/hooks/core.{js,d.ts}` are **generated** (`npm run build:plugin-core`); never hand-edit.
- Named colors are removed entirely — no `string` color values anywhere after this plan.
- Per-workspace scripts (root `typecheck` is broken): `npm test -w @ccstatus/core`, `npm test -w @sushant-kum/ccstatus`, `npm run typecheck -w <ws>`.

## Review Focus

- A hand-edited config with an out-of-range (`300`, `-1`, `1.5`) or 0–15 index → warn + migrate/drop, **never throw**, config still loads. _(Task 3)_
- A legacy config with string color names (`"bgCyan"`, `"brightWhite"`) → migrated to indices with a warning. _(Task 3)_
- `toAnsi` must **never** emit basic `30–47`/`90–107` or `38;5;0–15`/`48;5;0–15` (those dim). _(Task 2)_
- `contrastFg` threshold-boundary backgrounds stay readable (light→black 16, dark→white 231). _(Task 2)_
- A bg-only slot auto-contrasts; a slot with neither field → terminal default (no crash). _(Task 2)_

---

## Task 1: xterm-256 foundation (`theme/xterm256.ts`)

**Files:**

- Create: `packages/core/src/theme/xterm256.ts`
- Test: `packages/core/src/theme/xterm256.test.ts`

**Interfaces:**

- Produces: `indexToRgb(i: number): [number, number, number]`, `indexToHex(i: number): string`, `NAMED_INDEX: Record<string, number>` (legacy name → index), `BLACK = 16`, `WHITE = 231`.

- [ ] **Step 1: Write failing tests** `packages/core/src/theme/xterm256.test.ts`

```ts
import { expect, test } from 'vitest';

import { BLACK, WHITE, indexToHex, indexToRgb, NAMED_INDEX } from './xterm256.js';

test('cube corners and midpoints', () => {
  expect(indexToRgb(16)).toEqual([0, 0, 0]); // BLACK
  expect(indexToRgb(231)).toEqual([255, 255, 255]); // WHITE
  expect(indexToRgb(196)).toEqual([255, 0, 0]);
  expect(indexToRgb(46)).toEqual([0, 255, 0]);
  expect(indexToRgb(21)).toEqual([0, 0, 255]);
});

test('grayscale ramp', () => {
  expect(indexToRgb(232)).toEqual([8, 8, 8]);
  expect(indexToRgb(255)).toEqual([238, 238, 238]);
});

test('indexToHex formats 6-digit lowercase hex', () => {
  expect(indexToHex(16)).toBe('#000000');
  expect(indexToHex(231)).toBe('#ffffff');
  expect(indexToHex(196)).toBe('#ff0000');
});

test('BLACK/WHITE constants', () => {
  expect(BLACK).toBe(16);
  expect(WHITE).toBe(231);
});

test('NAMED_INDEX maps the 16 legacy names into 16–255', () => {
  for (const idx of Object.values(NAMED_INDEX)) {
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(16);
    expect(idx).toBeLessThanOrEqual(255);
  }
  expect(NAMED_INDEX['brightWhite']).toBe(231);
  expect(NAMED_INDEX['black']).toBe(16);
  expect(NAMED_INDEX['cyan']).toBe(44);
});
```

- [ ] **Step 2: Run tests, verify they fail** — `npm test -w @ccstatus/core -- xterm256` → FAIL (module not found).

- [ ] **Step 3: Implement** `packages/core/src/theme/xterm256.ts`

```ts
// Single source of truth for the xterm-256 palette: index → RGB, index → hex, and the
// legacy-name → index migration table. Indices 0–15 dim in the status line, so the palette
// is 16–255; this module is written for that range (0–15 never reach it — validation keeps
// them out, and the migration table maps them to cube equivalents).

/** Pure black (cube) and pure white (cube) — the auto-contrast foreground choices. */
export const BLACK = 16;
export const WHITE = 231;

const LEVEL = [0, 95, 135, 175, 215, 255] as const;

/**
 * Returns the sRGB bytes for an xterm-256 index in 16–255 (216-cube then 24-step grayscale).
 * @param i - The palette index (callers pass 16–255).
 * @returns The [r, g, b] bytes, each 0–255.
 */
export function indexToRgb(i: number): [number, number, number] {
  if (i >= 232) {
    const g = 8 + (i - 232) * 10;
    return [g, g, g];
  }
  const n = i - 16;
  return [LEVEL[Math.floor(n / 36)] ?? 0, LEVEL[Math.floor((n % 36) / 6)] ?? 0, LEVEL[n % 6] ?? 0];
}

const hex2 = (v: number): string => v.toString(16).padStart(2, '0');

/**
 * Returns the `#rrggbb` hex string for an xterm-256 index, for Ink's color props.
 * @param i - The palette index (16–255).
 * @returns The lowercase 6-digit hex color.
 */
export function indexToHex(i: number): string {
  const [r, g, b] = indexToRgb(i);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/**
 * Legacy chalk-style color names → xterm-256 index (all in 16–255, avoiding the dimmed 0–15).
 * `bg`-prefixed names map to the same index as their base (fg/bg is now a field, not a prefix).
 */
export const NAMED_INDEX: Record<string, number> = {
  black: 16,
  brightBlack: 240,
  gray: 240,
  red: 160,
  brightRed: 196,
  green: 40,
  brightGreen: 46,
  yellow: 184,
  brightYellow: 226,
  blue: 20,
  brightBlue: 21,
  magenta: 164,
  brightMagenta: 201,
  cyan: 44,
  brightCyan: 51,
  white: 250,
  brightWhite: 231,
};
```

- [ ] **Step 4: Run tests, verify pass** — `npm test -w @ccstatus/core -- xterm256` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/theme/xterm256.ts packages/core/src/theme/xterm256.test.ts
git commit -m "feat(core): add xterm-256 index→rgb/hex and name→index tables"
```

---

## Task 2: Core numeric color flip + rendering

Flip the color value type from `string` (name) to `number` (index) across the whole core color pipeline, keeping core compiling and its tests green. This is one coherent change (the types ripple together).

**Files:**

- Modify: `packages/core/src/config/types.ts`, `packages/core/src/colors.ts`, `packages/core/src/colors.test.ts`, `packages/core/src/theme/contrast.ts`, `packages/core/src/theme/contrast.test.ts`, `packages/core/src/theme/themes.ts`, `packages/core/src/theme/themes.test.ts`, `packages/core/src/layout/cells.ts`, `packages/core/src/layout/cells.test.ts`, `packages/core/src/render-model.ts`, `packages/core/src/layout/palette.ts`, `packages/core/src/layout/palette.test.ts`, `packages/core/src/layout/compose.ts` (+ test if color-typed), `packages/core/src/ansi.ts`, `packages/core/src/ansi.test.ts`, `packages/core/src/renderer-colors.ts`, `packages/core/src/renderer-colors.test.ts`, `packages/core/src/config/validate.ts`, `packages/core/src/config/validate.test.ts`, `packages/core/src/index.ts`, `packages/core/src/render.test.ts`

**Interfaces:**

- Consumes: Task 1 (`indexToRgb`, `indexToHex`, `NAMED_INDEX`, `BLACK`, `WHITE`).
- Produces: `PaletteSlot = { fg?: number; bg?: number }`; `isColorIndex(n): n is number`; `contrastFg(bg: number): number`; `Cell.fg/bg: number | undefined`; `Segment.fg/bg: number | undefined`; `toAnsi` 256 form; `rendererColor/rendererBg(i?: number): string | undefined` (hex).

- [ ] **Step 1: `colors.ts` — replace name set with index guard**

```ts
/**
 * Checks whether a value is a usable xterm-256 palette index (integer 16–255).
 * Indices 0–15 are excluded — Claude Code dims them in the status line.
 * @param x - The value to test.
 * @returns `true` when the value is an integer in 16–255.
 */
export function isColorIndex(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 16 && x <= 255;
}
```

Replace `colors.test.ts` accordingly:

```ts
import { expect, test } from 'vitest';

import { isColorIndex } from './colors.js';

test('accepts 16–255 integers, rejects 0–15, out-of-range, and non-integers', () => {
  expect(isColorIndex(16)).toBe(true);
  expect(isColorIndex(255)).toBe(true);
  expect(isColorIndex(45)).toBe(true);
  expect(isColorIndex(15)).toBe(false);
  expect(isColorIndex(0)).toBe(false);
  expect(isColorIndex(256)).toBe(false);
  expect(isColorIndex(-1)).toBe(false);
  expect(isColorIndex(1.5)).toBe(false);
  expect(isColorIndex('45')).toBe(false);
  expect(isColorIndex(undefined)).toBe(false);
});
```

- [ ] **Step 2: `theme/contrast.ts` — luminance-based numeric contrast**

```ts
import { BLACK, indexToRgb, WHITE } from './xterm256.js';

/** Rec.709 luma threshold (0–255): at or above → dark text, below → light text. */
const LUMA_THRESHOLD = 128;

/**
 * Returns a readable foreground index (black 16 or white 231) for a background index,
 * from the background's luminance. Used for palette slots that set a bg but no fg.
 * @param bg - The background palette index (16–255).
 * @returns `16` (black) on light backgrounds, `231` (white) on dark ones.
 */
export function contrastFg(bg: number): number {
  const [r, g, b] = indexToRgb(bg);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma >= LUMA_THRESHOLD ? BLACK : WHITE;
}
```

Replace `contrast.test.ts`:

```ts
import { expect, test } from 'vitest';

import { contrastFg } from './contrast.js';

test('black (16) on light backgrounds', () => {
  for (const bg of [44 /* cyan */, 184 /* yellow */, 40 /* green */, 231 /* white */, 226]) {
    expect(contrastFg(bg)).toBe(16);
  }
});

test('white (231) on dark backgrounds', () => {
  for (const bg of [20 /* blue */, 160 /* red */, 164 /* magenta */, 240 /* grey */, 16]) {
    expect(contrastFg(bg)).toBe(231);
  }
});
```

- [ ] **Step 3: `config/types.ts` — numeric `PaletteSlot`**

Change the `PaletteSlot` type so both fields are `number`:

```ts
/**
 * One slot of a positional palette. Colors are xterm-256 indices (16–255). A slot with a bg
 * but no fg gets an auto-contrast fg; a slot with neither renders at the terminal default.
 */
export interface PaletteSlot {
  fg?: number;
  bg?: number;
}
```

(`Theme = PaletteSlot[]` and `ItemStyle` are unchanged.)

- [ ] **Step 4: `layout/cells.ts` and `render-model.ts` — numeric `fg`/`bg`**

In `cells.ts`, change the `Cell` interface fields `fg?: string; bg?: string;` → `fg?: number; bg?: number;` (nothing else in `itemToCell`/`lineToCells` changes — cells are still emitted uncolored; palette assigns later).

In `render-model.ts`, change `Segment.fg?: string; bg?: string;` → `fg?: number; bg?: number;`.

- [ ] **Step 5: `layout/palette.ts` — numeric flow (logic unchanged)**

Only the types change (the `contrastFg` call now returns a number, `pal?.fg`/`pal?.bg` are numbers). The continuation/flex/reset logic is unchanged. Verify it compiles; update any `string` annotations to `number`.

`palette.test.ts`: replace the string color fixtures with indices, e.g.:

```ts
const theme: Theme = [
  { fg: 16, bg: 44 }, // black on cyan
  { fg: 231, bg: 20 }, // white on blue
];
// cycles → bg [44, 20, 44]; fg [16, 231, 16]
// bg-only auto-contrast: assignPaletteColors([cell('a')], [{ bg: 184 }])[0] → { bg: 184, fg: 16 }
// explicit fg wins: assignPaletteColors([cell('a')], [{ fg: 160, bg: 44 }])[0] → { fg: 160, bg: 44 }
```

Keep every existing behavioral case (cycle, merge-shares-slot, merge-after-flex-not-continuation, flex-no-slot, empty palette, explicit-fg-wins), just with numeric colors.

- [ ] **Step 6: `layout/compose.ts` — numeric separators**

`composeLine` colors powerline separators from adjacent cells' numeric `bg`. Update any `string` color annotations to `number`; logic unchanged. Update `compose.test.ts` color fixtures to indices if present.

- [ ] **Step 7: `ansi.ts` — 256-color serialization**

Replace the `FG`/`BG` name tables and `sgr` body:

```ts
import type { RenderModel, Segment } from './render-model.js';

/**
 * Serializes a styled segment to a 256-color SGR-wrapped string.
 * @param seg - The styled segment (fg/bg are xterm-256 indices).
 * @returns The text wrapped in `38;5;`/`48;5;` codes, or plain text when it has no colors.
 */
function sgr(seg: Segment): string {
  const codes: string[] = [];
  if (seg.fg !== undefined) {
    codes.push(`\x1b[38;5;${seg.fg}m`);
  }
  if (seg.bg !== undefined) {
    codes.push(`\x1b[48;5;${seg.bg}m`);
  }
  if (!codes.length) {
    return seg.text;
  }
  return `${codes.join('')}${seg.text}\x1b[0m`;
}

/**
 * Serializes a render model into a 256-color ANSI string for the native status line.
 * @param model - The render model whose lines/segments are serialized.
 * @returns The lines joined by newlines, each segment wrapped in 256-color SGR codes.
 */
export function toAnsi(model: RenderModel): string {
  return model.lines.map((line) => line.segments.map(sgr).join('')).join('\n');
}
```

`ansi.test.ts`: assert a segment `{ fg: 16, bg: 44 }` serializes to `\x1b[38;5;16m\x1b[48;5;44m...\x1b[0m`; assert the output contains **no** basic codes (`/\x1b\[(3|4|9|10)[0-7]m/`) and no `38;5;` / `48;5;` with an index ≤ 15.

- [ ] **Step 8: `renderer-colors.ts` — index → hex (delete name mapping)**

```ts
import { indexToHex } from './theme/xterm256.js';

/**
 * Maps a core foreground index to an Ink/chalk hex color.
 * @param fg - The foreground palette index, if any.
 * @returns The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererColor = (fg?: number): string | undefined =>
  fg === undefined ? undefined : indexToHex(fg);

/**
 * Maps a core background index to an Ink/chalk hex color.
 * @param bg - The background palette index, if any.
 * @returns The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererBg = (bg?: number): string | undefined =>
  bg === undefined ? undefined : indexToHex(bg);
```

Replace `renderer-colors.test.ts`: `rendererColor(16)` → `'#000000'`, `rendererBg(44)` → `indexToHex(44)`, `rendererColor(undefined)` → `undefined`.

- [ ] **Step 9: `theme/themes.ts` — builtin themes as indices**

```ts
import type { Theme } from '../config/types.js';

type P = [fg: number, bg: number];
const mk = (rows: P[]): Theme => rows.map(([fg, bg]) => ({ fg, bg }));

// Builtin positional palettes as xterm-256 indices (16–255). Translated from the previous
// named palettes via NAMED_INDEX (black=16, brightWhite=231; see xterm256.ts) — see DEC for 256.
export const builtinThemes: Record<string, Theme> = {
  default: mk([
    [16, 44],
    [231, 20],
    [16, 226],
    [231, 240],
    [16, 40],
  ]),
  classic: mk([
    [16, 184],
    [16, 250],
    [16, 40],
    [231, 20],
    [16, 164],
    [16, 44],
    [16, 226],
    [231, 160],
  ]),
  nord: mk([
    [16, 51],
    [16, 44],
    [16, 20],
    [231, 240],
    [16, 21],
    [16, 40],
    [16, 184],
    [231, 16],
  ]),
  dracula: mk([
    [16, 164],
    [16, 201],
    [16, 46],
    [16, 51],
    [16, 226],
    [16, 196],
    [231, 240],
    [231, 164],
  ]),
  gruvbox: mk([
    [16, 184],
    [16, 226],
    [16, 40],
    [16, 44],
    [16, 160],
    [16, 164],
    [231, 240],
    [231, 16],
  ]),
  monokai: mk([
    [16, 46],
    [16, 226],
    [16, 201],
    [16, 51],
    [16, 196],
    [231, 240],
    [16, 184],
    [231, 16],
  ]),
  'one-dark': mk([
    [16, 20],
    [16, 21],
    [16, 40],
    [16, 164],
    [16, 184],
    [16, 44],
    [231, 240],
    [231, 16],
  ]),
  solarized: mk([
    [231, 20],
    [16, 44],
    [16, 184],
    [231, 40],
    [231, 164],
    [231, 160],
    [231, 240],
    [231, 16],
  ]),
  'tokyo-night': mk([
    [16, 21],
    [16, 20],
    [16, 46],
    [16, 201],
    [16, 226],
    [16, 51],
    [231, 240],
    [231, 16],
  ]),
};
```

`themes.test.ts`: validate every slot color via `isColorIndex` (so none is 0–15 or out of range); keep the DEC-0022-style guard but as `expect(isColorIndex(slot.fg)).toBe(true)` for every defined fg/bg; keep the 9-theme count and defaultConfig assertions.

- [ ] **Step 10: `config/validate.ts` — minimal numeric `cleanThemes`**

Rewrite the per-slot loop in `cleanThemes` to validate numeric indices (full legacy/0–15 migration is **Task 3**). For now: keep a field when `isColorIndex(v)`, else drop the field with a warning. Keep the array/object-shape handling, the `{}`-for-non-object-slot behavior, and the prototype-free container from the current code.

```ts
const entry = rawSlot as { fg?: unknown; bg?: unknown };
const slot: PaletteSlot = {};
for (const key of ['fg', 'bg'] as const) {
  const v = entry[key];
  if (v === undefined) {
    continue;
  }
  if (isColorIndex(v)) {
    slot[key] = v;
  } else {
    warn(`dropped invalid color ${String(v)} in theme "${name}" (slot ${i})`);
  }
}
slots.push(slot);
```

Update the import from `colors.js` to `isColorIndex`. `validate.test.ts`: update theme fixtures to numeric indices; a slot with `fg: 45` is kept, a slot with `fg: 5` or `fg: 999` or `fg: "bgCyan"` drops that field with a warning (migration of those is added in Task 3 — for now assert the drop+warn and that `loadConfig` does not throw).

- [ ] **Step 11: `index.ts` — exports**

Export `isColorIndex` (from colors) and `indexToRgb`, `indexToHex` (from xterm256) if not already; keep `PaletteSlot` exported. Remove any now-dead `COLORS`/`isColor` export.

- [ ] **Step 12: Fix `render.test.ts` and any remaining fixtures**

Update the positional-color integration test's expectations: cells carry numeric `fg`/`bg`; the per-line reset test still holds (same bg index on line 2 slot 0). Assert `typeof cell.bg === 'number'`.

- [ ] **Step 13: Run the full core gate**

```bash
npm run typecheck -w @ccstatus/core
npm test -w @ccstatus/core
```

Expected: typecheck clean, all tests PASS. Fix any missed `string`→`number` annotation until green.

- [ ] **Step 14: Commit**

```bash
git add packages/core
git commit -m "feat(core)!: colors are xterm-256 indices (16-255), rendered via 38;5;/hex"
```

---

## Task 3: Legacy + out-of-range migration in `cleanThemes`

**Files:**

- Modify: `packages/core/src/config/validate.ts`, `packages/core/src/config/validate.test.ts`

**Interfaces:**

- Consumes: `NAMED_INDEX` (Task 1), `isColorIndex` (Task 2).

- [ ] **Step 1: Write failing tests** in `validate.test.ts`

```ts
test('a legacy string color migrates to its index with a warning', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: { mine: [{ fg: 'brightWhite', bg: 'bgCyan' }] },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{ fg: 231, bg: 44 }]);
  expect(warnings.some((w) => w.includes('256-color'))).toBe(true);
});

test('a 0–15 index migrates to its cube equivalent with a warning', () => {
  const { config, warnings } = loadConfig({ version: 1, theme: 'm', themes: { m: [{ bg: 7 }] } });
  expect(config.themes.m).toEqual([{ bg: 250 }]); // ANSI 7 (white) → 250
  expect(warnings.some((w) => w.includes('dims'))).toBe(true);
});

test('an out-of-range / garbage color drops the field with a warning, never throws', () => {
  const raw = { version: 1, theme: 'm', themes: { m: [{ fg: 300, bg: 'notacolor' }] } };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.m).toEqual([{}]);
  expect(warnings.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests, verify they fail** — `npm test -w @ccstatus/core -- validate` → the migration cases FAIL (currently dropped, not migrated).

- [ ] **Step 3: Implement** — extend the per-field loop in `cleanThemes`:

```ts
const ANSI16 = [16, 160, 40, 184, 20, 164, 44, 250, 240, 196, 46, 226, 21, 201, 51, 231];

// inside the fg/bg loop, replacing the Task 2 body:
if (v === undefined) {
  continue;
}
if (isColorIndex(v)) {
  slot[key] = v;
} else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 15) {
  const mapped = ANSI16[v] ?? 16;
  slot[key] = mapped;
  warn(`color index ${v} dims in the status line; using ${mapped} in theme "${name}" (slot ${i})`);
} else if (typeof v === 'string' && NAMED_INDEX[v] !== undefined) {
  const mapped = NAMED_INDEX[v];
  slot[key] = mapped;
  warn(`named colors are now 256-color indices; using ${mapped} for "${v}" in theme "${name}"`);
} else if (typeof v === 'string' && v.startsWith('bg') && NAMED_INDEX[baseName(v)] !== undefined) {
  const mapped = NAMED_INDEX[baseName(v)];
  slot[key] = mapped;
  warn(`named colors are now 256-color indices; using ${mapped} for "${v}" in theme "${name}"`);
} else {
  warn(`dropped invalid color ${String(v)} in theme "${name}" (slot ${i})`);
}
```

Add a `baseName` const-arrow near the top of validate.ts: strips a `bg` prefix and lowercases the first remaining char (`bgCyan`→`cyan`). Import `NAMED_INDEX` from `../theme/xterm256.js`. `ANSI16` indexes 0–15 → the migration targets (matches the spec's parenthetical mapping).

- [ ] **Step 4: Run tests, verify pass** — `npm test -w @ccstatus/core -- validate` → PASS; confirm `loadConfig` still never throws on garbage.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/validate.ts packages/core/src/config/validate.test.ts
git commit -m "feat(core): migrate legacy named colors and 0-15 indices to 256-color"
```

---

## Task 4: TUI — hex paint + cube/grayscale picker

**Files:**

- Modify: `packages/tui/src/paint.tsx`, `packages/tui/src/screens/themes.tsx`, `packages/tui/src/screens/themes.test.tsx`, `packages/tui/src/screens/items.tsx` (verify only), `packages/tui/src/config-store.test.ts`
- Delete: `packages/tui/src/named-colors.ts` (and its test if any)

**Interfaces:**

- Consumes: `indexToHex` (core), numeric `PaletteSlot`.

- [ ] **Step 1: `paint.tsx` — hex via core**

Replace `inkColor`/`inkBg` (the name mappers) with `indexToHex` from `@ccstatus/core`. Any painter that rendered a core color name now does `color={fg === undefined ? undefined : indexToHex(fg)}`. Remove the `NAMED_COLORS`/name-mapping imports.

- [ ] **Step 2: `screens/themes.tsx` — numeric slots + cube/grayscale picker**

- Slot rows show `idx` values; the fg/bg swatches paint via `indexToHex`.
- Replace the fg/bg name lists with a **swatch picker** over indices, laid out as **6 cube blocks of 6×6** (indices 16–231, one block per red level) followed by the **24-step grayscale ramp** (232–255), each swatch painted with that index's bg via `indexToHex` and the selected one highlighted with a live `idx N` label. Model the pickable sequence as `PICK_INDICES: number[] = [16..231, 232..255]` (length 240) plus a `(none)` sentinel to clear a field. Navigation: `↑/↓` move between rows, `←/→` within a row, across block boundaries and into the ramp; the behavioral contract the tests pin is: **every index 16–255 is reachable**, `⏎` sets `entry[field] = PICK_INDICES[cursor]` (a number), `(none)` deletes the field, all writes immutable.
- Keep the existing immutable write pattern (`theme.map`/spread), the `a`/`x` add/remove-slot, `n`/`d` new/duplicate, and `(empty palette)` behaviors.

- [ ] **Step 3: `screens/themes.test.tsx` — update**

Update fixtures/assertions to numeric indices and `indexToHex` painting. Keep the behavioral tests: a slot fg edit is immutable (prop unchanged, new array identity), `(none)` clears a field, `a` appends / `x` removes a slot, a new empty theme shows `(empty palette)`. Add: picking a cube index sets `entry.fg`/`entry.bg` to that number; the DEC-0022-style guard is now moot (no `'white'`), so assert instead that a set color is a valid index (16–255).

- [ ] **Step 4: `items.tsx` + `config-store.test.ts`**

`items.tsx` has no per-item colors (removed in 0.2.0) — verify it needs no change. `config-store.test.ts` round-trips config through `loadConfig` on save: update any theme fixture to numeric indices and assert the saved theme holds indices.

- [ ] **Step 5: Run the TUI gate**

```bash
npm run typecheck -w @sushant-kum/ccstatus
npm test -w @sushant-kum/ccstatus
```

Expected: clean + PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tui
git commit -m "feat(tui): numeric palette slots and 256-color cube/grayscale picker"
```

---

## Task 5: Regenerate plugin bundle + plugin checks

**Files:**

- Modify (generated): `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`
- Verify: `plugin/hooks/paint.tsx`

- [ ] **Step 1: Verify `plugin/hooks/paint.tsx`** forwards numeric `seg.fg`/`seg.bg` to `rendererColor`/`rendererBg` (now number→hex). It should need no change (it passes through). If it has a `string` annotation on a color, update to `number`.

- [ ] **Step 2: Regenerate the bundle**

```bash
npm run build:plugin-core
```

- [ ] **Step 3: Structural + pure checks**

```bash
node scripts/check-plugin.mjs
npm run test:plugin-pure
```

Expected: structure OK, pure tests PASS.

- [ ] **Step 4: Commit**

```bash
git add plugin/hooks/core.js plugin/hooks/core.d.ts plugin/hooks/paint.tsx
git commit -m "build: regenerate plugin core bundle for 256-color palette"
```

---

## Task 6: Docs — DECs, CLAUDE.md, final gate

**Files:**

- Modify: `docs/DECISION.md`, `CLAUDE.md`

- [ ] **Step 1: `docs/DECISION.md`** — append two entries + index rows, and mark DEC-0005 superseded:

- `DEC-0023` — "Colors are an xterm-256 palette (indices 16–255), not named terminal colors." Context: the status-line dimming finding (CC dims 0–15; 256-cube renders crisp; truecolor unsupported). Decision: `PaletteSlot` numeric 16–255, one `indexToRgb` table for both painters (`38;5;`/`48;5;` + hex), luminance `contrastFg`. Alternatives: keep names + 256-serialize (rejected — no new color choice); truecolor (rejected — unsupported in status line). Note it **absorbs DEC-0022** and **supersedes DEC-0005**.
- `DEC-0024` — "Breaking migration to 256-color indices." `cleanThemes` migrates legacy string names and 0–15 to cube indices with warnings, drops out-of-range; `loadConfig` non-throwing. Mirrors DEC-0021.
- Edit the **DEC-0005** entry's status line to `Superseded by DEC-0023` (append-only: do not rewrite its body, only add the superseded marker as the convention allows). Add both index-table rows (dated 2026-10-13).

- [ ] **Step 2: `CLAUDE.md`** — replace the "named terminal colors only" / color-name-gotcha bullet and the "Theme colors are positional" color detail with: colors are xterm-256 indices 16–255 (0–15 dim in the status line and are rejected); one `indexToRgb` table drives `toAnsi` (`38;5;`/`48;5;`) and Ink (hex); `contrastFg` is luminance-based. Reference DEC-0023/DEC-0024.

- [ ] **Step 3: Full repo gate**

```bash
npm run typecheck -w @ccstatus/core && npm run typecheck -w @sushant-kum/ccstatus
npm test -w @ccstatus/core && npm test -w @sushant-kum/ccstatus
node scripts/check-plugin.mjs && npm run test:plugin-pure
npm run lint && npm run format:check && npm run cspell && npm run knip && npm run secretlint
git diff --quiet || echo "UNCOMMITTED CHANGES"
npm run build:plugin-core && git diff --quiet plugin/hooks || echo "BUNDLE DRIFT"
```

Expected: all green, no drift. Fix cspell by rewording (not by weakening the dictionary) if a new word trips it.

- [ ] **Step 4: Commit**

```bash
git add docs/DECISION.md CLAUDE.md
git commit -m "docs: record 256-color palette (DEC-0023, DEC-0024)"
```
