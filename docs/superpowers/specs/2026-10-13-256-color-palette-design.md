# 256-Color Palette — Design

**Status:** Approved (pending spec review)
**Date:** 2026-10-13
**Supersedes:** DEC-0005 (named terminal colors only), absorbs DEC-0022 (brightWhite)
**Ships as:** 0.3.0 (breaking)

## Goal

Replace ccstatus's 16 basic named colors with the **256-color palette** (xterm-256),
for both the mod and the native status line, so the bar renders crisp everywhere and
offers ~240 colors instead of 16.

## Motivation

The native status line (rendered by Claude Code from a `settings.json` command) renders
**dim/grey** text. Investigation proved:

- ccstatus emits correct full-brightness SGR for both surfaces; the mod's Ink painter and
  the statusline's `toAnsi` produce byte-identical codes.
- Claude Code dims the **low ANSI palette (indices 0–15)** in the status-line region — in
  both the basic `30–37`/`90–97` form and the `38;5;0–15` form. Bold (`ESC[1m`) does not
  counteract it.
- The **256-color cube/grayscale range (16–255)** renders at full brightness in the status
  line. (Verified live: `ESC[38;5;16m`/`ESC[38;5;231m` are crisp black/white; `ESC[38;5;0m`
  is grey.)
- Truecolor (24-bit) is **not supported** in the status line, so 256 is the ceiling.

Moving the whole color model to 256-cube indices (16–255) therefore fixes the dimming,
unifies mod/statusline rendering (same RGB), and gives far more color choice.

## Color model

- A color is an **integer `16–255`**: the 216-color cube (16–231) plus the 24-step
  grayscale ramp (232–255). Indices **0–15 are not part of the palette** (they dim in the
  status line); the picker never offers them and the schema rejects them.
- `PaletteSlot = { fg?: number; bg?: number }`. Foreground vs background is the **field**;
  the `bg…` name prefix is gone. Both use the same index space.
- `Theme = PaletteSlot[]` and the positional model (DEC-0020/0021) are unchanged — only the
  color _value type_ changes from `string` (name) to `number` (index).

### Canonical index → RGB (xterm-256)

A pure function in core (`theme/xterm256.ts`), single source of truth for both painters and
for contrast:

```ts
/** sRGB bytes [r,g,b] (0–255) for an xterm-256 index 16–255. */
export function indexToRgb(i: number): [number, number, number] {
  if (i >= 232) {
    const g = 8 + (i - 232) * 10; // 8,18,…,238
    return [g, g, g];
  }
  const n = i - 16; // 0–215
  const level = [0, 95, 135, 175, 215, 255];
  return [level[Math.floor(n / 36)] ?? 0, level[Math.floor((n % 36) / 6)] ?? 0, level[n % 6] ?? 0];
}
```

(Indices 0–15 never reach this function; validation keeps them out. For safety the function
clamps/treats out-of-range as the nearest valid value, but callers always pass 16–255.)

## Rendering — one RGB table, two painters

- **Status line** (`ansi.ts` `toAnsi`): emit `ESC[38;5;<fg>m` and `ESC[48;5;<bg>m`, reset
  with `ESC[0m`. No more name→SGR tables.
- **Mod + TUI** (Ink): convert the index to `#rrggbb` (via `indexToRgb`) and pass it to Ink's
  `color` / `backgroundColor`. Ink renders truecolor hex inline (crisp; truecolor works inline,
  only the status line forbids it). `renderer-colors.ts`'s name-ordering mapping
  (`brightYellow`→`yellowBright`) and the `brightGray` exception are **deleted** — replaced by
  one `indexToHex(i)` helper.

Because both painters derive from the same `indexToRgb`, the mod and status line render the
**same color** — eliminating the historical hue difference between surfaces.

## Auto-contrast (luminance)

`contrast.ts` `contrastFg(bgIndex: number): number` replaces the named `LIGHT_BG` lookup:

```ts
const [r, g, b] = indexToRgb(bg);
const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec.709 luma, 0–255
return luma >= 128 ? 16 /* black */ : 231; /* white */
```

Threshold `128` is a named constant. This supersedes DEC-0005's "no luminance computation"
(which only existed because named colors had no RGB).

## Validation & migration (`loadConfig` stays non-throwing)

- **Schema** (`schema.ts`): `themes` stays the loose `z.record(z.unknown())` it is today; the
  real per-slot validation lives in `cleanThemes` (smart-constructor pattern), so a bad color
  warns+drops rather than failing the whole parse. No new strict slot schema.
- **`colors.ts`**: `COLORS`/`isColor(name)` → `isColorIndex(n): n is number` =
  `Number.isInteger(n) && n >= 16 && n <= 255`.
- **`cleanThemes`** per slot field:
  - integer 16–255 → keep.
  - integer 0–15 → map to its nearest cube equivalent via the name/index table below
    (0–15 are the ANSI colors) and **warn** ("index N dims in the status line; using M").
  - **legacy string color** (old configs: `"bgCyan"`, `"brightWhite"`, …) → map via the
    **name → index table** and warn ("named colors are now 256-color indices; using N").
  - anything else (out-of-range number, unknown string, non-number/string) → drop the field
    with a warning.
- Per-item colors are already gone (0.2.0); nothing new there.

### Name → index migration table

Used for (a) migrating legacy string colors, (b) mapping 0–15, and (c) re-expressing the
builtin themes. All targets are in 16–255. `bg`-prefixed legacy names map to the same index
as their base (now placed in the `bg` field).

| name    | idx | name               | idx |
| ------- | --- | ------------------ | --- |
| black   | 16  | brightBlack / gray | 240 |
| red     | 160 | brightRed          | 196 |
| green   | 40  | brightGreen        | 46  |
| yellow  | 184 | brightYellow       | 226 |
| blue    | 20  | brightBlue         | 21  |
| magenta | 164 | brightMagenta      | 201 |
| cyan    | 44  | brightCyan         | 51  |
| white   | 250 | brightWhite        | 231 |

(ANSI index 0→16, 1→160, 2→40, 3→184, 4→20, 5→164, 6→44, 7→250, 8→240, 9→196, 10→46,
11→226, 12→21, 13→201, 14→51, 15→231.)

## Builtin themes

Re-express the 9 builtin themes (`themes.ts`) by applying the name→index table to their
current values — a deterministic transform. Example `default`:

```ts
default: [
  { fg: 16, bg: 44 },   // was black / bgCyan
  { fg: 231, bg: 20 },  // was brightWhite / bgBlue
  { fg: 16, bg: 226 },  // was black / bgBrightYellow
  { fg: 231, bg: 240 }, // was brightWhite / bgBrightBlack
  { fg: 16, bg: 40 },   // was black / bgGreen
],
```

The remaining 8 themes transform the same way. (Richer hand-tuned 256-color themes are a
possible follow-up, out of scope here.)

## TUI color picker

Replace the current fg/bg name lists with a **swatch picker**:

- **Layout:** the 6×6×6 cube as **6 blocks of 6×6** swatches (one block per red level), then
  the **24-step grayscale ramp** (232–255) below, then `16` (black) and `231` (white) are part
  of the cube already. Each swatch is a cell painted with that index's bg; the selected swatch
  is highlighted and the screen shows `idx N` + a live preview of the slot.
- **Navigation:** arrows move within/between blocks and into the grayscale ramp; `⏎` picks;
  `esc` cancels. A `(none)` option clears the field (unchanged behavior).
- The slot editor still has fg and bg fields; `←/→` switches field, `⏎` opens the picker.
- `named-colors.ts`, `inkColor`/`inkBg` name mapping, and the chalk-name lists are removed;
  the picker and preview paint via `indexToHex`.

## Removed / simplified

- `renderer-colors.ts`: the `toInk` name reordering and `brightGray` exception → one
  `indexToHex(i)`.
- `contrast.ts`: `LIGHT_BG` set and `baseColor` → luminance.
- `colors.ts`: the `COLORS` name set and `cap`/`fg`/`bg` builders → `isColorIndex`.
- `ansi.ts`: the `FG`/`BG` SGR name tables → `38;5;`/`48;5;` emit.
- `config/types.ts`: `PaletteSlot` fields become `number`.
- Color value type flows numeric through the pipeline: `layout/cells.ts` `Cell.fg/bg` and
  `render-model.ts` `Segment.fg/bg` change from `string` to `number`.

## Decisions to record

- **New DEC** — 256-color palette (indices 16–255, cube+grayscale), `PaletteSlot` numeric,
  one RGB table for both painters, luminance contrast. Marks **DEC-0005 Superseded by** it and
  notes it absorbs DEC-0022.
- **New DEC** — breaking migration: legacy string colors and 0–15 mapped to cube indices with
  warnings; out-of-range dropped; `loadConfig` non-throwing (mirrors DEC-0021).
- Update `CLAUDE.md`: replace the "named terminal colors only" / color-name-gotcha bullet with
  the 256-index model and the 0–15-dims-in-statusline finding.

## Testing focus

- `indexToRgb`: cube corners (16→[0,0,0], 231→[255,255,255], 196→[255,0,0]) and grayscale
  (232→[8,8,8], 255→[238,238,238]).
- `contrastFg`: light indices (cyan 44, yellow 184, white 231, green 40) → 16; dark indices
  (blue 20, red 160, magenta 164, grey 240, black 16) → 231; threshold boundary.
- `toAnsi`: emits `38;5;`/`48;5;` for a slot; never emits basic `30–37`/`40–47` or any
  `38;5;0–15`/`48;5;0–15`.
- Migration: legacy `"brightWhite"`→231, `"bgCyan"`→44 (bg field), index `7`→250 with warning,
  index `300`/`-1`/garbage dropped with warning; a full legacy named theme loads to indices;
  `loadConfig` never throws.
- Builtin themes: every slot color is a valid index 16–255 (guards against a stray 0–15 or
  out-of-range), and none is in 0–15.
- Render integration: a themed line's cells carry numeric fg/bg; mod/TUI hex and statusline
  `38;5;` derive from the same index.

## Out of scope

- Truecolor / hex input (CC status line doesn't support it; 256 is the ceiling).
- Indices 0–15 as selectable colors (they dim in the status line).
- Hand-designed richer 256-color builtin themes (future).
- Per-item colors (already removed in 0.2.0).

## Versioning

Breaking (color value type + config format change) → **0.3.0**. Plugin bundle regenerated.
