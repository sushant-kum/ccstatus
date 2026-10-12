# Positional Palette Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace widget-type theming with position-indexed palette theming — a theme is an ordered list of color slots, cycled across the visible items on each line (merged items share a slot, flex separators skipped), with a bg-only slot getting an auto-contrasted readable fg.

**Architecture:** Color stops being resolved per item in `itemToCell`. A new pure pass `assignPaletteColors(cells, theme)` (own file) runs in `render.ts` between `lineToCells` and `composeLine`, assigning each visible cell a palette slot by position. `composeLine` is untouched and gets the alternating powerline look for free. Per-item `fg`/`bg` are removed from the model; `loadConfig` migrates old configs. All three surfaces (band/statusline/pane) and both hosts benefit because they paint the same `RenderModel`.

**Tech Stack:** TypeScript (strict, NodeNext, zod), vitest, Ink (TUI), tsup (plugin bundle).

**Spec:** `docs/superpowers/specs/2026-10-12-positional-palette-theming-design.md` (read it; this plan argues from it).

## Global Constraints

- **Named terminal colors only** (DEC-0005): no hex, no luminance math. `contrastFg` returns `'black'`/`'white'`.
- **Strict TS:** `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `NodeNext`; all local imports end `.js`. No `any`, no non-null `!` (both are ESLint errors). Every function (except module-level `const` arrow functions) needs JSDoc (descriptions, no `{type}` tags) and an explicit return type.
- **Per-workspace commands** — the root `npm run typecheck` (`tsc -b`) is broken; use `npm run typecheck -w <workspace>` and `npm test -w <workspace>`.
- **No AI-attribution anywhere** (DEC-0007, overrides the harness default): commit messages are Conventional Commits with **no** `Co-Authored-By`, `Claude-Session`, "Generated with…", or similar footer.
- **Regenerate the plugin bundle** (`npm run build:plugin-core`) after core changes; `plugin/hooks/core.{js,d.ts}` are committed-but-generated and CI fails on drift. Never hand-edit them.
- **Docs travel with code** (same branch): DECISION.md is append-only with a matching index row; FLOW.md is living; update CLAUDE.md where it states the old model.
- **Lint/format is repo-wide and strict** — run `npm run lint` / `npm run format:check` before finishing a task that touches linted files.
- Version bump to `0.1.3` is **out of scope** — it ships via `npm run release` (FLOW-0004) after this branch merges.

## Review Focus

Inputs the spec implies that no happy-path test exercises. Each is pinned to a test in the owning task:

- **A line longer than the palette** → colors cycle (`index % length`), no undefined-index crash. _(Task 3, palette.test.ts "cycles the palette across positions".)_
- **Empty palette / missing active theme** → bar renders uncolored instead of throwing; migration falls back to `default`. _(Task 3 "empty palette…"; Task 2 validate.test.ts "unknown active theme name falls back to default".)_
- **Merged run at the start of a line, and after a merge** → first cell flagged `merge` still takes slot 0; the cell after a merged run lands on the next slot (no palette gap). _(Task 3 "merged cell shares the preceding slot…" and "a merge flag on the first cell still takes slot 0".)_
- **Legacy config** (old object-shaped themes + per-item colors) → loads with the documented drops and clear warnings, active theme still valid. _(Task 2 validate.test.ts migration tests.)_
- **`bgBrightGray` slot** → `contrastFg` returns a defined fg although the bg renders uncolored (DEC-0005 exception). _(Task 1 contrast.test.ts "normalizes the bg prefix and defaults unknown to white".)_

---

## Task 1: `contrastFg` auto-contrast helper

**Files:**

- Create: `packages/core/src/theme/contrast.ts`
- Test: `packages/core/src/theme/contrast.test.ts`

**Interfaces:**

- Produces: `contrastFg(bg: string): string` — returns `'black'` on light named backgrounds, `'white'` otherwise.

- [ ] **Step 1: Write the failing test**

`packages/core/src/theme/contrast.test.ts`:

```ts
import { expect, test } from 'vitest';

import { contrastFg } from './contrast.js';

test('black on light backgrounds', () => {
  for (const bg of [
    'bgCyan',
    'bgYellow',
    'bgGreen',
    'bgWhite',
    'bgBrightYellow',
    'bgBrightCyan',
    'bgBrightGreen',
    'bgBrightWhite',
  ]) {
    expect(contrastFg(bg)).toBe('black');
  }
});

test('white on dark backgrounds', () => {
  for (const bg of [
    'bgBlack',
    'bgRed',
    'bgBlue',
    'bgMagenta',
    'bgBrightBlack',
    'bgBrightRed',
    'bgBrightBlue',
    'bgBrightMagenta',
  ]) {
    expect(contrastFg(bg)).toBe('white');
  }
});

test('normalizes the bg prefix and defaults unknown to white', () => {
  expect(contrastFg('bgCyan')).toBe('black');
  expect(contrastFg('bgBrightGray')).toBe('white'); // renders uncolored, but fg stays defined
  expect(contrastFg('totally-unknown')).toBe('white');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ccstatus/core -- contrast`
Expected: FAIL (module not found / `contrastFg` undefined).

- [ ] **Step 3: Write the implementation**

`packages/core/src/theme/contrast.ts`:

```ts
// Named-background → readable foreground, for palette slots that give a background but no explicit
// foreground. Backgrounds are named terminal colors (DEC-0005), so contrast is a fixed lookup, not a
// luminance computation.

// Base color names (bg-prefix stripped) whose backgrounds are light enough to need black text.
const LIGHT_BG = new Set<string>([
  'green',
  'yellow',
  'cyan',
  'white',
  'brightGreen',
  'brightYellow',
  'brightCyan',
  'brightWhite',
]);

const baseColor = (bg: string): string => {
  if (!bg.startsWith('bg')) {
    return bg;
  }
  const rest = bg.slice(2);
  return rest.charAt(0).toLowerCase() + rest.slice(1);
};

/**
 * Returns a readable foreground color name for a named background.
 * @param bg - A background color name (e.g. "bgCyan", "bgBrightBlack").
 * @returns  "black" on light backgrounds, "white" on dark ones.
 */
export function contrastFg(bg: string): string {
  return LIGHT_BG.has(baseColor(bg)) ? 'black' : 'white';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @ccstatus/core -- contrast`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -w @ccstatus/core`

```bash
git add packages/core/src/theme/contrast.ts packages/core/src/theme/contrast.test.ts
git commit -m "feat(core): add contrastFg named-color auto-contrast helper"
```

---

## Task 2: Core model swap — positional palette types, builtins, validation & migration

This is the atomic model change: altering `Theme`/`ItemStyle` forces `themes.ts`, `cells.ts`,
`validate.ts`, `schema.ts`, and `import-ccstatusline.ts` to change together so core compiles. Color is
**not** applied at render yet (the palette pass lands in Task 3–4); `render.test.ts` only asserts
text, so it stays green.

**Files:**

- Modify: `packages/core/src/config/types.ts`
- Modify: `packages/core/src/config/schema.ts`
- Modify: `packages/core/src/theme/themes.ts`
- Modify: `packages/core/src/layout/cells.ts`
- Modify: `packages/core/src/config/validate.ts`
- Modify: `packages/core/src/config/import-ccstatusline.ts`
- Modify: `packages/core/src/index.ts` (export `PaletteSlot`)
- Test (update): `packages/core/src/theme/themes.test.ts`, `packages/core/src/layout/cells.test.ts`, `packages/core/src/config/validate.test.ts`, `packages/core/src/config/import-ccstatusline.test.ts`

**Interfaces:**

- Produces: `PaletteSlot { fg?: string; bg?: string }`; `Theme = PaletteSlot[]`; `ItemStyle { merge?; align?; rawValue? }` (no colors); `builtinThemes: Record<string, Theme>`; `cleanItem`/`loadConfig` drop per-item colors and migrate legacy themes; `itemToCell` returns cells with no color (filled later).
- Consumes: nothing new (contrast lands in Task 3's pass).

- [ ] **Step 1: Change the types** (`config/types.ts`)

Add the slot type and rewrite `ItemStyle` + `Theme`:

```ts
// A single palette slot. Both optional: bg-only → auto-contrast fg; fg-only → colored text, no block;
// neither → terminal default.
export interface PaletteSlot {
  fg?: string;
  bg?: string;
}
```

```ts
// Styling an item may carry. Colors are NOT here — they come from the theme palette by position.
export interface ItemStyle {
  merge?: boolean;
  align?: Align;
  rawValue?: boolean;
}
```

```ts
// A theme is an ordered palette, cycled across visible items by position.
export type Theme = PaletteSlot[];
```

- [ ] **Step 2: Loosen the themes schema** (`config/schema.ts`)

Replace the `themes` field so legacy object-shaped themes parse (and migrate) instead of failing the
whole config — same "schema loose, validate.ts is the smart constructor" pattern as `itemSchema.type`.
Leave `itemSchema` unchanged (it keeps `fg`/`bg` so a legacy per-item color is visible to `cleanItem`).

```ts
  themes: z.record(z.unknown()).default({}),
```

- [ ] **Step 3: Convert builtins to palettes and delete `resolveColors`** (`theme/themes.ts`)

Replace the whole file body below the imports. Change the import to just the `Theme` type, drop
`resolveColors`, make `mk` return an array, drop the `WIDGETS` constant, and rewrite `default` as an
array:

```ts
import type { Theme } from '../config/types.js';

type P = [fg: string, bg: string];
const mk = (rows: P[]): Theme => rows.map(([fg, bg]) => ({ fg, bg }));

// Named-terminal-color approximations of ccstatusline's built-in palettes, applied positionally.
export const builtinThemes: Record<string, Theme> = {
  default: [
    { fg: 'black', bg: 'bgCyan' },
    { fg: 'white', bg: 'bgBlue' },
    { fg: 'black', bg: 'bgBrightYellow' },
    { fg: 'white', bg: 'bgBrightBlack' },
    { fg: 'black', bg: 'bgGreen' },
  ],
  classic: mk([
    ['black', 'bgYellow'],
    ['black', 'bgWhite'],
    ['black', 'bgGreen'],
    ['white', 'bgBlue'],
    ['black', 'bgMagenta'],
    ['black', 'bgCyan'],
    ['black', 'bgBrightYellow'],
    ['white', 'bgRed'],
  ]),
  nord: mk([
    ['black', 'bgBrightCyan'],
    ['black', 'bgCyan'],
    ['black', 'bgBlue'],
    ['white', 'bgBrightBlack'],
    ['black', 'bgBrightBlue'],
    ['black', 'bgGreen'],
    ['black', 'bgYellow'],
    ['white', 'bgBlack'],
  ]),
  dracula: mk([
    ['black', 'bgMagenta'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightCyan'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightRed'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgMagenta'],
  ]),
  gruvbox: mk([
    ['black', 'bgYellow'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgGreen'],
    ['black', 'bgCyan'],
    ['black', 'bgRed'],
    ['black', 'bgMagenta'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  monokai: mk([
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightCyan'],
    ['black', 'bgBrightRed'],
    ['white', 'bgBrightBlack'],
    ['black', 'bgYellow'],
    ['white', 'bgBlack'],
  ]),
  'one-dark': mk([
    ['black', 'bgBlue'],
    ['black', 'bgBrightBlue'],
    ['black', 'bgGreen'],
    ['black', 'bgMagenta'],
    ['black', 'bgYellow'],
    ['black', 'bgCyan'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  solarized: mk([
    ['white', 'bgBlue'],
    ['black', 'bgCyan'],
    ['black', 'bgYellow'],
    ['white', 'bgGreen'],
    ['white', 'bgMagenta'],
    ['white', 'bgRed'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  'tokyo-night': mk([
    ['black', 'bgBrightBlue'],
    ['black', 'bgBlue'],
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightCyan'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
};
```

- [ ] **Step 4: Stop resolving colors in `itemToCell`** (`layout/cells.ts`)

Remove the `import { resolveColors } from '../theme/themes.js';` line and the
`const { fg, bg } = resolveColors(item, config);` line. The return becomes (cells now carry no color;
the palette pass fills them in Task 3–4):

```ts
const merge = item.type === 'flex-separator' ? false : (item.merge ?? false);
return { text: flex ? '' : `${pad}${value}${pad}`, merge, flex };
```

`config` stays a parameter (padding still reads `config.defaults.padding`). `Cell` keeps its optional
`fg?`/`bg?`.

- [ ] **Step 5: Drop per-item colors and migrate themes** (`config/validate.ts`)

Add `builtinThemes` and the new types to the imports:

```ts
import { builtinThemes } from '../theme/themes.js';
```

```ts
import type {
  Align,
  Config,
  DataWidgetType,
  Item,
  ItemStyle,
  PaletteSlot,
  SurfaceLayout,
  Theme,
  ToastSurface,
  WidgetType,
} from './types.js';
```

Rewrite `cleanStyle` so it carries `merge`/`align`/`rawValue` and drops any per-item color with a warning:

```ts
function cleanStyle(raw: RawItem, type: string, warn: (s: string) => void): ItemStyle {
  const style: ItemStyle = {};
  if (raw.merge !== undefined) {
    style.merge = raw.merge;
  }
  if (raw.align !== undefined) {
    style.align = raw.align;
  }
  if (raw.rawValue !== undefined) {
    style.rawValue = raw.rawValue;
  }
  if (raw.fg !== undefined || raw.bg !== undefined) {
    warn(`dropped per-item color on a ${type} item; colors now come from the theme palette`);
  }
  return style;
}
```

Replace `cleanThemes` entirely:

```ts
/**
 * Validates themes as positional palettes, dropping legacy per-widget themes and invalid slots.
 * @param themes - The raw themes keyed by name; each value should be an array of palette slots.
 * @param warn   - Callback invoked for each dropped theme or stripped slot color.
 * @returns      The valid palette themes keyed by name.
 */
function cleanThemes(
  themes: Record<string, unknown>,
  warn: (s: string) => void
): Record<string, Theme> {
  const cleaned: Record<string, Theme> = {};
  for (const [name, value] of Object.entries(themes)) {
    if (!Array.isArray(value)) {
      warn(
        `theme "${name}" uses the old per-widget format and was dropped; colors are now a positional palette`
      );
      continue;
    }
    const slots: PaletteSlot[] = [];
    value.forEach((rawSlot, i) => {
      if (!rawSlot || typeof rawSlot !== 'object') {
        warn(`dropped invalid slot ${i} in theme "${name}"`);
        return;
      }
      const entry = rawSlot as { fg?: unknown; bg?: unknown };
      const slot: PaletteSlot = {};
      for (const key of ['fg', 'bg'] as const) {
        const v = entry[key];
        if (v === undefined) {
          continue;
        }
        if (typeof v === 'string' && isColor(v)) {
          slot[key] = v;
        } else {
          warn(`stripped unknown color "${String(v)}" in theme "${name}" (slot ${i})`);
        }
      }
      slots.push(slot);
    });
    cleaned[name] = slots;
  }
  return cleaned;
}
```

Replace the theme-selection block in `loadConfig` (the current `themesToUse` line and the
`themes: cleanThemes(themesToUse, warn)` field):

```ts
const cleaned = cleanThemes(p.themes, warn);
const themes = Object.keys(cleaned).length ? cleaned : clone(builtinThemes);
if (!('default' in themes)) {
  themes['default'] = clone(builtinThemes['default'] ?? []);
}
let theme = p.theme;
if (!(theme in themes)) {
  warn(`theme "${theme}" not found; using "default"`);
  theme = 'default';
}

const config: Config = {
  version: 1,
  theme,
  themes,
  defaults: { ...defaultConfig.defaults, ...p.defaults },
  surfaces: {
    band: surf('band'),
    statusline: surf('statusline'),
    pane: surf('pane'),
    toasts: cleanToasts(p.surfaces.toasts, warn),
  },
};
```

- [ ] **Step 6: Stop importing per-item bg in the ccstatusline importer** (`config/import-ccstatusline.ts`)

In `baseStyle`, drop the `bg` field from both the return type and the object, and update its JSDoc to
remove the background mention:

```ts
/**
 * Extracts the styling fields shared by every ccstatusline item that ccstatus can carry.
 * @param raw        - The raw ccstatusline item.
 * @param idFallback - The id prefix used when the item carries no id of its own.
 * @returns          The id plus raw-value and merge flags.
 */
function baseStyle(
  raw: Record<string, unknown>,
  idFallback: string
): { id: string; rawValue?: true; merge?: true } {
  return {
    id: String(raw['id'] ?? `${idFallback}-${Math.random().toString(36).slice(2)}`),
    rawValue: raw['rawValue'] === true || undefined,
    merge: raw['merge'] === true || undefined,
  };
}
```

- [ ] **Step 7: Export the slot type** (`config/index` — `packages/core/src/index.ts`)

Add `PaletteSlot` to the `export type { … } from './config/types.js';` list (keep the list alphabetical
near `Item`/`ItemStyle`).

- [ ] **Step 8: Update the core tests that assert the old model**

`theme/themes.test.ts` — remove the `resolveColors` import and its four tests; make the builtin check
iterate palette slots. Replace the file's body with:

```ts
import { expect, test } from 'vitest';

import { isColor } from '../colors.js';
import { defaultConfig } from '../config/defaults.js';

import { builtinThemes } from './themes.js';

test('builtinThemes has the 9 ccstatusline themes with valid colors', () => {
  expect(Object.keys(builtinThemes).sort()).toEqual([
    'classic',
    'default',
    'dracula',
    'gruvbox',
    'monokai',
    'nord',
    'one-dark',
    'solarized',
    'tokyo-night',
  ]);
  for (const theme of Object.values(builtinThemes)) {
    expect(Array.isArray(theme)).toBe(true);
    for (const slot of theme) {
      if (slot.fg !== undefined) {
        expect(isColor(slot.fg)).toBe(true);
      }
      if (slot.bg !== undefined) {
        expect(isColor(slot.bg)).toBe(true);
      }
    }
  }
});

test('defaultConfig folds in all builtin themes, default active', () => {
  expect(Object.keys(defaultConfig.themes)).toHaveLength(9);
  expect(defaultConfig.theme).toBe('default');
});
```

`layout/cells.test.ts` — the fake `config.themes` is now ignored by `itemToCell`; update the two
color-bearing expectations so cells carry no color (the palette pass colors them later). Replace the
`itemToCell pads and colors` test and the flex test's expectation:

```ts
test('itemToCell pads (palette colors are applied downstream)', () => {
  expect(itemToCell({ id: 'a', type: 'model' }, config, snap, {})).toEqual({
    text: ' Opus ',
    merge: false,
    flex: false,
  });
});
```

(The `flex cell is unpadded and flagged` test already expects `fg: undefined, bg: undefined`; change its
expected object to `{ text: '', merge: false, flex: true }`.)

`config/validate.test.ts` — replace the `unknown color is stripped with a warning` (item) test and the
`unknown theme color is stripped with a warning` (theme) test with the migration tests below; leave every
other test unchanged:

```ts
test('a per-item color is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'model', fg: 'bgCyan' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  const item = config.surfaces.band.lines[0]?.[0];
  expect(item?.type).toBe('model');
  expect((item as { fg?: string } | undefined)?.fg).toBeUndefined();
  expect(warnings.some((w) => w.includes('per-item color'))).toBe(true);
});

test('a legacy per-widget theme is dropped and builtins are used', () => {
  const raw = {
    version: 1,
    theme: 'default',
    themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(Array.isArray(config.themes.default)).toBe(true);
  expect(config.theme).toBe('default');
  expect(warnings.some((w) => w.includes('old per-widget format'))).toBe(true);
});

test('a positional palette theme with a bad slot color is stripped with a warning', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: {
      mine: [
        { fg: 'black', bg: 'bgCyan' },
        { fg: 'fuchsia', bg: 'bgBlue' },
      ],
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine?.[1]).toEqual({ bg: 'bgBlue' });
  expect(warnings.some((w) => w.includes('fuchsia'))).toBe(true);
});

test('an unknown active theme name falls back to default with a warning', () => {
  const { config, warnings } = loadConfig({ version: 1, theme: 'ghost', themes: {} });
  expect(config.theme).toBe('default');
  expect(warnings.some((w) => w.includes('ghost') && w.includes('default'))).toBe(true);
});

test('a valid positional palette theme is preserved', () => {
  const raw = { version: 1, theme: 'mine', themes: { mine: [{ fg: 'white', bg: 'bgRed' }] } };
  const { config } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{ fg: 'white', bg: 'bgRed' }]);
  expect(config.theme).toBe('mine');
});
```

`config/import-ccstatusline.test.ts` — in `maps known items into the band surface`, the imported item no
longer carries a background; change the `bg` assertion (line ~23) to:

```ts
expect((line[1] as { bg?: string }).bg).toBeUndefined();
```

- [ ] **Step 9: Run the full core suite + typecheck + lint**

Run: `npm run typecheck -w @ccstatus/core && npm test -w @ccstatus/core`
Expected: all green. If `index.test.ts` asserts the export surface, update it for `PaletteSlot`.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src package.json
git commit -m "feat(core)!: theme colors are a positional palette, not per widget type

BREAKING CHANGE: per-item fg/bg are removed and legacy per-widget themes are
dropped on load; colors now come from a positional palette (see DEC-0020)."
```

---

## Task 3: The palette-assignment pass

**Files:**

- Create: `packages/core/src/layout/palette.ts`
- Test: `packages/core/src/layout/palette.test.ts`

**Interfaces:**

- Consumes: `Cell` (`layout/cells.js`), `Theme` (`config/types.js`), `contrastFg` (`theme/contrast.js`).
- Produces: `assignPaletteColors(cells: Cell[], theme: Theme): Cell[]` — pure; new cells, never mutates input.

- [ ] **Step 1: Write the failing test**

`packages/core/src/layout/palette.test.ts`:

```ts
import { expect, test } from 'vitest';

import type { Theme } from '../config/types.js';

import type { Cell } from './cells.js';
import { assignPaletteColors } from './palette.js';

const cell = (text: string, o: Partial<Cell> = {}): Cell => ({
  text,
  merge: false,
  flex: false,
  ...o,
});
const theme: Theme = [
  { fg: 'black', bg: 'bgCyan' },
  { fg: 'white', bg: 'bgBlue' },
];

test('cycles the palette across positions', () => {
  const out = assignPaletteColors([cell('a'), cell('b'), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgBlue', 'bgCyan']);
  expect(out.map((c) => c.fg)).toEqual(['black', 'white', 'black']);
});

test('auto-contrasts a bg-only slot', () => {
  const out = assignPaletteColors([cell('a')], [{ bg: 'bgYellow' }]);
  expect(out[0]).toMatchObject({ bg: 'bgYellow', fg: 'black' });
});

test('an fg-only slot sets fg and no bg', () => {
  const out = assignPaletteColors([cell('a')], [{ fg: 'red' }]);
  expect(out[0]?.fg).toBe('red');
  expect(out[0]?.bg).toBeUndefined();
});

test('merged cell shares the preceding slot and does not advance the counter', () => {
  const out = assignPaletteColors([cell('a'), cell('b', { merge: true }), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgCyan', 'bgBlue']);
});

test('a merge flag on the first cell still takes slot 0', () => {
  const out = assignPaletteColors([cell('a', { merge: true }), cell('b')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgBlue']);
});

test('flex cells are uncolored and consume no slot', () => {
  const out = assignPaletteColors([cell('a'), cell('', { flex: true }), cell('b')], theme);
  expect(out[0]?.bg).toBe('bgCyan');
  expect(out[1]?.bg).toBeUndefined();
  expect(out[1]?.fg).toBeUndefined();
  expect(out[2]?.bg).toBe('bgBlue');
});

test('empty palette leaves cells uncolored', () => {
  const out = assignPaletteColors([cell('a'), cell('b')], []);
  expect(out.every((c) => c.fg === undefined && c.bg === undefined)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @ccstatus/core -- palette`
Expected: FAIL (`assignPaletteColors` undefined).

- [ ] **Step 3: Write the implementation**

`packages/core/src/layout/palette.ts`:

```ts
import type { Theme } from '../config/types.js';
import { contrastFg } from '../theme/contrast.js';

import type { Cell } from './cells.js';

/**
 * Assigns palette colors to cells by position, cycling the palette. Merged cells reuse the preceding
 * slot (so a merged run is one color and the next independent cell keeps the correct slot); flex cells
 * stay uncolored and consume no slot. Pure: returns new cells and never mutates the input.
 * @param cells - The cells for one line, in order (nulls already dropped, not yet merged).
 * @param theme - The active palette; an empty palette leaves every cell uncolored.
 * @returns     New cells with fg/bg filled from the palette.
 */
export function assignPaletteColors(cells: Cell[], theme: Theme): Cell[] {
  if (theme.length === 0) {
    return cells.map((c) => ({ ...c }));
  }
  const out: Cell[] = [];
  let slot = -1;
  for (const c of cells) {
    if (c.flex) {
      out.push({ ...c });
      continue;
    }
    if (!(c.merge && slot >= 0)) {
      slot += 1;
    }
    const pal = theme[slot % theme.length];
    const bg = pal?.bg;
    const fg = pal?.fg ?? (bg !== undefined ? contrastFg(bg) : undefined);
    out.push({ ...c, fg, bg });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -w @ccstatus/core -- palette`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -w @ccstatus/core`

```bash
git add packages/core/src/layout/palette.ts packages/core/src/layout/palette.test.ts
git commit -m "feat(core): add positional palette-assignment pass"
```

---

## Task 4: Wire the palette pass into `render`

**Files:**

- Modify: `packages/core/src/render.ts`
- Test: `packages/core/src/render.test.ts` (add a color assertion)

**Interfaces:**

- Consumes: `assignPaletteColors` (`layout/palette.js`), the active theme from `config.themes[config.theme]`.

- [ ] **Step 1: Write the failing test** — append to `packages/core/src/render.test.ts`:

```ts
test('positional palette colors every segment and alternates backgrounds', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 120 });
  const [line] = model.lines;
  if (!line) {
    throw new Error('expected a rendered line');
  }
  const cells = line.segments.filter((s) => s.kind === 'cell');
  expect(cells.length).toBeGreaterThanOrEqual(2);
  for (const c of cells) {
    expect(c.bg).toBeDefined(); // no terminal-default grey
    expect(c.fg).toBeDefined();
  }
  expect(cells[0]?.bg).not.toBe(cells[1]?.bg); // positional alternation
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @ccstatus/core -- render`
Expected: FAIL (cells have no bg/fg — the pass isn't wired yet).

- [ ] **Step 3: Wire the pass** (`render.ts`)

Add the import and insert the pass between `lineToCells` and `composeLine`:

```ts
import { assignPaletteColors } from './layout/palette.js';
```

```ts
const theme = config.themes[config.theme] ?? [];

const lines = surface.lines
  .map((items) => lineToCells(items, config, snapshot, outputs))
  .filter((cells) => cells.length > 0)
  .map((cells) => assignPaletteColors(cells, theme))
  .map((cells) => ({
    segments: composeLine(cells, config.defaults.separator, opts.width, config.defaults.glyph),
  }));
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm test -w @ccstatus/core && npm run typecheck -w @ccstatus/core`
Expected: all green (the existing band/glyph text tests still pass).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/render.ts packages/core/src/render.test.ts
git commit -m "feat(core): apply positional palette colors in render"
```

---

## Task 5: Regenerate the plugin bundle and verify the plugin

**Files:**

- Modify (generated): `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`

**Interfaces:** none (build artifact only).

- [ ] **Step 1: Regenerate the committed core bundle**

Run: `npm run build:plugin-core`

- [ ] **Step 2: Verify the plugin structure and pure tests**

Run: `node scripts/check-plugin.mjs && npm run test:plugin-pure`
Expected: both pass. If a plugin pure module fails to typecheck against the new `core.d.ts` (it should
not — the mod paints `RenderModel` segments, not item colors), stop and report; do not hand-edit the
generated files.

- [ ] **Step 3: Commit the regenerated bundle**

```bash
git add plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "build: regenerate plugin core bundle for positional palette theming"
```

---

## Task 6: TUI — palette-only item editor and palette theme editor

Removing `fg`/`bg` from `ItemStyle` and making `Theme` an array breaks `items.tsx` and `themes.tsx`
together, so the TUI typecheck only greens once both are updated — hence one task.

**Files:**

- Modify: `packages/tui/src/screens/items.tsx`
- Modify: `packages/tui/src/screens/themes.tsx`
- Test (update): `packages/tui/src/screens/items.test.tsx`, `packages/tui/src/screens/themes.test.tsx`

**Interfaces:**

- Consumes: `Theme`, `PaletteSlot`, `ItemStyle` (no colors) from `@ccstatus/core`.

- [ ] **Step 1: Strip per-item color editing from `items.tsx`**

- Change `const FIELDS = ['fg', 'bg', 'raw', 'merge', 'align'] as const;` to
  `const FIELDS = ['raw', 'merge', 'align'] as const;`.
- Delete the `FG`, `BG` color-list constants, the `Swatch` component, and `cycleColor`.
- In `change(dir)`, delete the `fg`/`bg` branches; keep `raw`/`merge`/`align`.
- In `Chip`, drop the `color`/`backgroundColor` props and the `fg`/`bg` reads:
  ```tsx
  function Chip({ item, selected }: { item: Item; selected: boolean }): ReactElement {
    return <Text inverse={selected}>[ {item.type} ]</Text>;
  }
  ```
- In the editor render, delete the `row(0, 'fg', …)` and `row(1, 'bg', …)` lines and renumber the rest:
  `row(0, 'raw', …)`, `row(1, 'merge', …)`, `row(2, 'align', …)`.
- Remove now-unused imports: `NAMED_COLORS`, and `inkBg`/`inkColor` (verify nothing else in the file
  uses them). Keep `isStylable` (still used by `patch`).

- [ ] **Step 2: Rewrite `themes.tsx` as a per-slot palette editor**

The active theme is now `PaletteSlot[]`. Replace the per-widget rows with per-slot rows:

- `list` mode unchanged: `↑/↓` select · `⏎` activate · `→` edit slots · `n` new (an **empty** palette
  `[]`) · `d` duplicate (`structuredClone` of the array).
- `slots` mode (was `colors`): rows are palette slots `0..n-1`, each showing fg + bg. Keys: `↑/↓` select
  slot · `←/→` fg/bg field · `⏎` open picker · `a` append a slot (`{}`) · `x` remove the selected slot ·
  `esc` back. Writing a slot replaces that index immutably in a new array.
- `picker` mode unchanged in shape: fg list is the non-`bg` names, bg list is the `bg*` names plus
  `(none)` to clear the field.
- Use `theme[slotIndex]` (array) rather than `theme[widgetName]`; derive slot count from `theme.length`.
  Keep `uniqueName`, the `setThemes` helper, and activation via `setConfig({ ...config, theme: name })`.

- [ ] **Step 3: Update the TUI tests**

`items.test.tsx`:

- In `e edits: ↓ to raw, → toggles rawValue…`, `raw` is now field 0, so remove the two `DOWN` presses
  before the `RIGHT` that toggles `rawValue`; keep the `tab`/`esc` assertions.
- Delete the `fg and bg cycle to a color…` test entirely.
- The remaining tests (list/remove, add, reorder, link/unlink, linked propagation) are unaffected.

`themes.test.tsx`:

- Keep `enter on another theme activates it` and `d duplicates the selected theme` (arrays duplicate
  fine; `themes['default-copy']` equals the `default` array).
- Rewrite `lists themes … shows its widget colors` → assert it lists `default (active)`, `nord`, and
  shows a slot background name (e.g. `bgCyan`, which is in the default palette).
- Rewrite `picker edits a widget fg within the theme` → drive into `slots` mode, pick a new fg for
  slot 0, and assert `c.themes.default[0].fg` changed while `c.themes.default[0].bg` stays `bgCyan` and
  the original `defaultConfig.themes.default[0].fg` is unchanged (immutability).

- [ ] **Step 4: Run the full TUI suite + typecheck**

Run: `npm run typecheck -w @sushant-kum/ccstatus && npm test -w @sushant-kum/ccstatus`
Expected: all green. If another TUI file (e.g. `app.test.tsx`, `preview.test.tsx`) fails to typecheck
because it constructs an item with `fg`/`bg` or a record-shaped theme, update that construction to the
new model.

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`

```bash
git add packages/tui/src/screens
git commit -m "feat(tui): palette-only item editor and positional palette theme editor"
```

---

## Task 7: Documentation — DEC entries, CLAUDE.md, FLOW

**Files:**

- Modify: `docs/DECISION.md` (add DEC-0020, DEC-0021 + index rows)
- Modify: `CLAUDE.md` (theme/color sections)
- Modify: `docs/FLOW.md` (verify/touch any color-resolution wording)

**Interfaces:** none.

- [ ] **Step 1: Append DEC-0020 and DEC-0021** (copy the entry template; add matching index rows)

- **DEC-0020 — Theme colors are a positional palette, not per widget type.** Context: widget-type
  themes covered only 5–8 of ~36 types, leaving uncovered widgets terminal-default grey, and color
  followed widget identity rather than position (unlike ccstatusline's powerline themes). Decision: a
  theme is `PaletteSlot[]`, cycled by visible position; merged cells share a slot; flex separators are
  skipped; a bg-only slot gets an auto-contrasted fg (`contrastFg`, named colors per DEC-0005); palette
  assignment is a separate pure pass (`layout/palette.ts`) wired into `render`. Consequences: per-item
  `fg`/`bg` removed (palette-only); all surfaces colored by position. Related: DEC-0005, DEC-0002,
  DEC-0008, this spec.
- **DEC-0021 — Breaking config migration to positional palettes.** Context: existing configs carry
  per-item colors and per-widget object-shaped themes. Decision: `loadConfig` drops per-item colors with
  a warning, drops legacy object-shaped themes with a warning and falls back to the builtin palettes,
  seeds a `default` palette, and reassigns an unknown active theme to `default`. Consequence: a one-time
  visible restyle of existing configs, accepted pre-1.0. Related: DEC-0004, DEC-0020.

- [ ] **Step 2: Update CLAUDE.md**

Rewrite the Theme sentence under "Conventions / gotchas" (the `defaults.glyph`/theme area and any line
describing `Theme = Record<widgetType, …>` or "only 5–8 covered") to describe positional palettes:
a theme is an ordered `PaletteSlot[]` applied by visible position (cycling, merged share a slot, flex
skipped), and a bg-only slot gets a readable auto-contrast fg via `contrastFg`. Keep the existing
color-name gotcha about `rendererColor`/`rendererBg` and the `brightGray`/`bgBrightGray` exception.

- [ ] **Step 3: Verify FLOW.md**

Check FLOW-0001 and FLOW-0007 for any wording that says color is resolved per widget/item; if present,
correct it and bump that entry's `Last verified` to 2026-10-12. If none references color resolution,
make no FLOW change (note this in the commit body).

- [ ] **Step 4: Commit**

```bash
git add docs/DECISION.md docs/FLOW.md CLAUDE.md
git commit -m "docs: record positional palette theming (DEC-0020, DEC-0021)"
```

---

## Final verification (whole branch, before finishing)

- [ ] `npm run typecheck -w @ccstatus/core && npm test -w @ccstatus/core`
- [ ] `npm run typecheck -w @sushant-kum/ccstatus && npm test -w @sushant-kum/ccstatus`
- [ ] `node scripts/check-plugin.mjs && npm run test:plugin-pure`
- [ ] `npm run lint && npm run format:check && npm run cspell`
- [ ] Confirm `git status` shows no unexpected changes to `plugin/hooks/core.{js,d.ts}` (bundle is fresh).

## Self-review notes (plan author)

- **Spec coverage:** data model (T2), contrast (T1), separate pass (T3), render wiring (T4), migration
  (T2), built-ins (T2), TUI (T6), docs/DEC/CLAUDE/FLOW (T7), bundle regeneration (T5) — all mapped.
- **Type consistency:** `PaletteSlot`/`Theme` defined in T2 and consumed identically in T3/T4/T6;
  `assignPaletteColors(cells, theme)` signature matches between palette.ts (T3) and render.ts (T4).
- **Review Focus:** every bullet has a named test in T1–T3.
- **Red window:** between T2 and T4 the renderer emits uncolored cells; `render.test.ts` asserts only
  text there, so core stays green across the gap, and T4 restores + asserts color.
