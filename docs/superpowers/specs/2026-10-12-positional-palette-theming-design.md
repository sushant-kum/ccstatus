# Positional Palette Theming — Design

**Status:** Draft for review
**Date:** 2026-10-12
**Scope:** core | tui (+ plugin bundle regen, docs)
**Ships as:** 0.1.3

## Problem

A theme today maps **widget type → `{fg, bg}`** (`Theme = Record<string, {fg?, bg?}>`,
`resolveColors` in `packages/core/src/theme/themes.ts`). The eight built-in palettes
(`nord`, `dracula`, `gruvbox`, …) are `{fg, bg}` rows, but `mk()` staples each row onto the
first eight entries of a fixed `WIDGETS` list. Consequences the user hit:

- Any widget outside the covered types (there are ~36 widget types; themes cover 5–8) resolves
  to no color and renders **terminal-default grey** on its background.
- Color follows widget identity, not position, so a bar's colors don't form the alternating
  powerline pattern and change meaning when items are reordered.

This matches ccstatusline's model only superficially. ccstatusline's **powerline themes assign
colors by segment _position_**: visible widgets get a slot number by order (`assignPowerlineThemeSlots`),
merged widgets share a slot, separators are skipped, and the renderer indexes a per-slot
`{fg[], bg[]}` palette that cycles. fg is hand-picked per slot for contrast.

## Goal

Replace widget-type theming with **position-indexed palette theming**: a theme is an ordered list
of color slots, cycled across the visible items on each line, with merged items sharing a slot and
flex separators skipped. A slot may specify `bg` only and get an auto-contrasted readable `fg`.

### Decisions locked with the user

1. **Full replacement.** The widget-type theme model is removed everywhere (band/statusline/pane);
   `loadConfig` migrates existing configs.
2. **bg + optional fg, auto-contrast fallback.** A slot's `fg` defaults to a readable black/white
   derived from its `bg` when `fg` is omitted.
3. **Palette-only.** Per-item `fg`/`bg` are removed. Items keep `merge`, `align`, `rawValue`.
4. **Separate pass.** Palette assignment is its own pure function, not folded into `composeLine`.

## Non-goals

- Hex / truecolor / 256-color tiers — DEC-0005 (named 16 colors) stands; we implement the equivalent
  of ccstatusline's color-level-1 only.
- `continueThemeAcrossLines` — the slot counter **resets per line** (ccstatusline's default). A future
  toggle can add continuity; not now (YAGNI).
- Changing `defaults.invert` / per-item `align` application — still deferred (DEC-0006).
- Preserving existing per-item colors or custom widget-type themes across the migration. They are
  dropped by design (see Migration); this is a one-time breaking config change, acceptable pre-1.0.

## Data model (`packages/core/src/config/types.ts`)

```ts
// A single palette slot. Both optional: bg-only → auto-contrast fg; fg-only → colored text, no block;
// neither → terminal default.
export interface PaletteSlot {
  fg?: string;
  bg?: string;
}

// A theme is an ordered palette, cycled across visible items by position.
export type Theme = PaletteSlot[];

// Styling an item may carry. Colors are NOT here anymore — they come from the theme palette.
export interface ItemStyle {
  merge?: boolean;
  align?: Align;
  rawValue?: boolean;
}
```

`DataItem` / `CustomTextItem` / `CustomCommandItem` still spread `ItemStyle` and are unchanged in
shape beyond losing `fg`/`bg`. `StylableItem`, `Config`, `config.theme`, and
`config.themes: Record<string, Theme>` keep their names; only a theme's _value type_ changes from a
widget-keyed object to a `PaletteSlot[]`.

## Color resolution

### `contrastFg` — `packages/core/src/theme/contrast.ts` (new)

```ts
/**
 * Returns a readable foreground color name (black or white) for a named background.
 * @param bg - A background color name (e.g. "bgCyan", "bgBrightBlack").
 * @returns  "black" on light backgrounds, "white" on dark ones.
 */
export function contrastFg(bg: string): string;
```

- Normalize `bg` to its base color the same way `compose.ts`'s `bgToFg` does: strip a leading `bg`
  and lowercase the first remaining char (`bgCyan` → `cyan`).
- Lookup table over the 16 named colors:
  - **black fg** (light bg): `green`, `yellow`, `cyan`, `white`, `brightGreen`, `brightYellow`,
    `brightCyan`, `brightWhite`.
  - **white fg** (dark bg): `black`, `red`, `blue`, `magenta`, `brightBlack`, `brightRed`,
    `brightBlue`, `brightMagenta`, `brightGray`.
- Unknown / unmapped base → `white` (safe default).
- Returns a valid named color, so it passes through `rendererColor`/`inkColor` unchanged and honors
  DEC-0005 (no hex, no luminance math).

### `assignPaletteColors` — `packages/core/src/layout/palette.ts` (new, the separate pass)

```ts
/**
 * Assigns palette colors to cells by position, cycling the palette; merged cells share the
 * preceding slot and flex cells stay uncolored. Pure: returns new cells, never mutates input.
 * @param cells - The cells for one line, in order (nulls already dropped, not yet merged).
 * @param theme - The active palette; an empty palette leaves every cell uncolored.
 * @returns     New cells with fg/bg filled from the palette.
 */
export function assignPaletteColors(cells: Cell[], theme: Theme): Cell[];
```

Algorithm (one line, counter resets each call = per-line reset):

- If `theme.length === 0`: return `cells.map((c) => ({ ...c }))` (no colors).
- Walk cells left→right with `let slot = -1`:
  - **flex cell** → push `{ ...c }` unchanged (no slot consumed, no color).
  - **merge continuation** (`c.merge && slot >= 0`) → do **not** advance `slot`; the cell reuses the
    current slot. (The first content cell never continues: `slot < 0`, so it takes slot 0 even if
    flagged `merge`.) Not advancing is what keeps the _next_ independent cell on the correct slot
    after `composeLine` folds merged text into its predecessor.
  - otherwise → `slot += 1`.
  - `const pal = theme[slot % theme.length]` (theme non-empty here; guard the index for
    `noUncheckedIndexedAccess`).
  - `const bg = pal?.bg; const fg = pal?.fg ?? (bg !== undefined ? contrastFg(bg) : undefined);`
  - push `{ ...c, fg, bg }`.

Why merged-cell color is correct either way: `composeLine`'s `mergeCells` concatenates a merged
cell's text into its predecessor and keeps the **predecessor's** color, so a merged cell's own color
is discarded. The one thing that matters is the slot counter not advancing on merge, so the cell
after a merged run lands on the next palette slot (no gap).

### `render.ts` wiring

Insert the pass between cell formatting and composition:

```ts
const theme: Theme = config.themes[config.theme] ?? [];
const lines = surface.lines
  .map((items) => lineToCells(items, config, snapshot, outputs))
  .filter((cells) => cells.length > 0)
  .map((cells) => assignPaletteColors(cells, theme))
  .map((cells) => ({
    segments: composeLine(cells, config.defaults.separator, opts.width, config.defaults.glyph),
  }));
```

`composeLine` is **unchanged** — it already reads `c.bg` for powerline separator/cap colors, so the
positional backgrounds produce the alternating segment look automatically.

### `cells.ts`

`itemToCell` stops importing/calling `resolveColors`; the returned `Cell` has `fg`/`bg` left
`undefined` (filled later by the pass). `Cell` keeps its `fg?`/`bg?` fields. `merge`/`flex` logic
unchanged (`item.merge` still exists on `ItemStyle`).

### `themes.ts`

- Delete `resolveColors`.
- `mk` becomes `(rows: P[]): Theme => rows.map(([fg, bg]) => ({ fg, bg }))`.
- `builtinThemes` becomes `Record<string, Theme>` (arrays). The eight `mk(...)` palettes
  (`classic`, `nord`, `dracula`, `gruvbox`, `monokai`, `one-dark`, `solarized`, `tokyo-night`)
  convert mechanically. `default` is rewritten as a short explicit array:

```ts
default: [
  { fg: 'black', bg: 'bgCyan' },
  { fg: 'white', bg: 'bgBlue' },
  { fg: 'black', bg: 'bgBrightYellow' },
  { fg: 'white', bg: 'bgBrightBlack' },
  { fg: 'black', bg: 'bgGreen' },
],
```

## Config validation & migration (`schema.ts`, `validate.ts`)

### Schema (`schema.ts`)

- `themes` loosens to `z.record(z.unknown()).default({})` — same "schema loose, `validate.ts` is the
  smart constructor" pattern already used for `itemSchema.type`. This lets old object-shaped themes
  parse instead of failing the whole config, so migration can warn precisely.
- `itemSchema` **keeps** `fg`/`bg` as `z.string().optional()` so a legacy per-item color is visible
  to `cleanItem` and can be dropped-with-warning (not silently ignored).

### `validate.ts`

- `RawItem` keeps `fg?`/`bg?`. `cleanStyle` no longer writes them; instead:
  ```ts
  if (raw.fg !== undefined || raw.bg !== undefined) {
    warn(`dropped per-item color on a ${type} item; colors now come from the theme palette`);
  }
  ```
  It still carries `merge`/`align`/`rawValue`.
- Replace `cleanThemes` with a palette-aware version:
  ```ts
  function cleanThemes(
    themes: Record<string, unknown>,
    warn: (s: string) => void
  ): Record<string, Theme>;
  ```
  For each `[name, value]`:
  - `Array.isArray(value)` → validate each element as a slot: keep `fg`/`bg` only when `isColor`,
    else strip that field with a warning (`stripped unknown color "<c>" in theme "<name>" (slot <i>)`);
    a non-object element is dropped with a warning. Result: `Theme`.
  - not an array (legacy widget-keyed object, or junk) → **drop** with
    `warn(\`theme "<name>" uses the old per-widget format and was dropped; colors are now a positional palette\`)`.
- `loadConfig` theme wiring (replaces the current `themesToUse` line):
  ```ts
  const cleaned = cleanThemes(p.themes as Record<string, unknown>, warn);
  const themes = Object.keys(cleaned).length ? cleaned : clone(builtinThemes);
  if (!('default' in themes)) {
    themes['default'] = clone(builtinThemes['default'] ?? []);
  }
  let theme = p.theme;
  if (!(theme in themes)) {
    warn(`theme "${theme}" not found; using "default"`);
    theme = 'default';
  }
  ```
  This preserves current semantics (user themes replace builtins when present; builtins seed an empty
  map) while guaranteeing a valid active theme and a `default` fallback. A config whose only themes
  were legacy object-shaped ends up with `cleaned` empty → full builtin palettes.

`defaultConfig` is unchanged in code (`themes: structuredClone(builtinThemes)`); its value is now
arrays. Default band items carry no colors, so the palette now colors the whole default bar — this
also fixes the grey-default-bar case for free.

## ccstatusline import (`import-ccstatusline.ts`)

`baseStyle` drops the `bg` field (items no longer carry color); its return type loses `bg`. Imported
per-item `backgroundColor` is not carried (consistent with palette-only); no per-item warning (the
importer is already warning-heavy). Documented behavior, covered by an updated import test.

## TUI (`packages/tui/src`)

### `screens/items.tsx`

- `FIELDS` → `['raw', 'merge', 'align']`. Remove the `fg`/`bg` editor rows, `Swatch`, the `FG`/`BG`
  color lists, `cycleColor`, and the `fg`/`bg` branches of `change`.
- `Chip` renders without `color`/`backgroundColor` (plain `[ type ]`, still `inverse` when selected).
- `patch(p: Partial<ItemStyle>)` now only ever sees `raw`/`merge`/`align`.

### `screens/themes.tsx` — palette editor (largest TUI change)

The active theme is now `PaletteSlot[]`. Rework the editor from per-widget rows to per-slot rows:

- **list mode** (unchanged behavior): `↑/↓` select theme · `⏎` activate · `→` edit slots · `n` new
  (empty palette `[]`) · `d` duplicate.
- **slots mode**: rows are palette slots `0..n-1`, each showing `fg` and `bg` swatches. Keys:
  `↑/↓` select slot · `←/→` fg/bg field · `⏎` open picker · `a` add slot (appended, `{}`) ·
  `x` remove selected slot · `esc` back.
- **picker mode** (unchanged shape): choose a named color for the selected slot's fg or bg; `fg` list
  excludes `bg*` names, `bg` list is the `bg*` names plus `(none)` to clear.
- Setting a slot writes an immutable new array into `config.themes[name]`.

### Preview

`preview.tsx` / `paint.tsx` are unaffected — they paint a `RenderModel` of positional segments, which
core now colors correctly.

## Docs & build

- **DEC-0020** — Positional palette theming (the model: position-indexed palettes, cycling,
  merge-shares-slot, flex-skipped, palette-only, bg+auto-contrast fg). Supersedes the widget-type
  theme convention; relates to DEC-0005, DEC-0002, DEC-0008.
- **DEC-0021** — Breaking config migration: per-item colors dropped, legacy object-shaped themes
  dropped and replaced by builtin palettes, builtins seed/fallback. Relates to DEC-0004, DEC-0020.
- **CLAUDE.md** — rewrite the theme description (the "`Theme = Record<...>`; only 5–8 covered" line)
  and the color-name gotcha to describe positional palettes + `contrastFg`.
- **`themes.ts` reference / comments** — update the "approximations of ccstatusline's built-in
  palettes" note to say positional.
- **FLOW** — no dedicated color-resolution FLOW exists; FLOW-0001/0007 describe the render path at a
  level this change doesn't alter, so no FLOW edit beyond a `Last verified` touch if wording references
  per-widget color (verify during implementation).
- **`npm run build:plugin-core`** — regenerate the committed bundle (core changed); CI drift check
  guards it.

## Testing

Core (vitest):

- `contrast.test.ts` — representative colors map to the expected black/white; `bg` prefix normalized;
  unknown → white.
- `palette.test.ts` (`assignPaletteColors`) — cycling past palette length; merge continuation shares
  a slot and does not advance the counter (cell after a merged run gets the next slot); flex cells
  uncolored and consume no slot; empty palette → all uncolored; bg-only slot → contrast fg; fg-only
  slot → fg set, no bg; first cell flagged `merge` → slot 0.
- `validate.test.ts` — legacy object theme dropped + builtins used; per-item `fg`/`bg` dropped with
  warning; array theme with a bad slot color stripped; unknown active theme → `default` + warning;
  empty themes → builtins.
- `themes.test.ts` — `builtinThemes` are arrays; `default` present; `mk` shape.
- `render`/`toAnsi` integration — a multi-item line yields alternating `bg` per position and a
  readable `fg` on every segment (no terminal-default fg where a bg is set).

TUI (vitest + ink-testing-library):

- `items.test.tsx` — editor no longer exposes fg/bg; `raw`/`merge`/`align` still work.
- `themes.test.tsx` — slot add/remove/recolor; new theme starts empty; activate still works.

## Review focus (inputs no task's happy path exercises)

- **A line longer than the palette** → colors cycle, no crash, no undefined index.
- **Empty palette / active theme missing** → bar renders uncolored rather than throwing; migration
  falls back to `default`.
- **Merged run at the start or end of a line, and consecutive merges** → slot counter stays correct;
  no palette-slot gap after the run.
- **Legacy config** (object themes + per-item colors) → loads without data loss beyond the documented
  drops, with clear warnings, active theme still valid.
- **`bgBrightGray` slot** → `contrastFg` returns a defined fg even though the bg renders uncolored
  (DEC-0005 exception); text stays legible.

```

```
