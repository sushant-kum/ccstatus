import { asIndex } from '../colors.js';
import type { Theme } from '../config/types.js';

type P = [fg: number, bg: number];
const mk = (rows: P[]): Theme => rows.map(([fg, bg]) => ({ fg: asIndex(fg), bg: asIndex(bg) }));
/**
 * Build a positional palette from parallel ccstatusline fg/bg index arrays.
 * @param fg - Foreground xterm-256 indices, one per slot.
 * @param bg - Background xterm-256 indices, one per slot.
 * @returns  The theme as `{ fg, bg }` slots.
 */
const zip = (fg: number[], bg: number[]): Theme =>
  fg.map((f, i) => ({ fg: asIndex(f), bg: asIndex(bg[i] ?? f) }));

// Builtin positional palettes as xterm-256 indices (16–255). The named themes mirror
// ccstatusline's POWERLINE_THEMES, using its 256-colour (ansi256) tier so the palettes match
// what ccstatusline renders in 256-colour terminals (the status line has no truecolor — DEC-0023).
// `default` is ccstatus's own out-of-box palette and has no ccstatusline counterpart. See DEC-0028.
export const builtinThemes: Record<string, Theme> = {
  default: mk([
    [16, 44],
    [231, 20],
    [16, 226],
    [231, 240],
    [16, 40],
  ]),
  nord: zip([16, 254, 231, 231, 16], [73, 239, 25, 96, 152]),
  'nord-aurora': zip([231, 16, 231, 16, 16], [131, 220, 68, 108, 176]),
  monokai: zip([235, 255, 235, 16, 235], [148, 238, 186, 141, 81]),
  solarized: zip([231, 234, 254, 16, 234], [33, 136, 240, 37, 254]),
  minimal: zip([255, 232, 255, 232, 252], [240, 251, 233, 248, 236]),
  dracula: zip([235, 235, 235, 235, 231], [141, 253, 204, 117, 236]),
  catppuccin: zip([235, 255, 235, 235, 235], [176, 238, 150, 210, 111]),
  gruvbox: zip([16, 235, 235, 16, 235], [167, 214, 246, 109, 142]),
  onedark: zip([235, 251, 235, 16, 235], [75, 237, 114, 204, 180]),
  tokyonight: zip([16, 234, 16, 234, 234], [111, 248, 176, 221, 80]),
};

// The built-in theme set before the ccstatusline-palette adoption (DEC-0028). Used only by
// `withBuiltinThemes` to recognise an unmodified legacy built-in in a saved config and refresh it,
// without clobbering a palette the user actually edited.
const legacyBuiltinThemes: Record<string, Theme> = {
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

// Active-theme names that were renamed or dropped in the ccstatusline-palette adoption; a saved
// config pointing at one resolves to its replacement instead of silently falling back to `default`.
export const legacyThemeAliases: Record<string, string> = {
  'one-dark': 'onedark',
  'tokyo-night': 'tokyonight',
  classic: 'default',
};

/**
 * Deep-compare two positional palettes slot by slot.
 * @param a - One theme.
 * @param b - The other theme.
 * @returns Whether they have the same slots in the same order.
 */
function sameTheme(a: Theme, b: Theme): boolean {
  return a.length === b.length && a.every((s, i) => s.fg === b[i]?.fg && s.bg === b[i]?.bg);
}

/**
 * Fold the current built-in themes into a saved themes map.
 *
 * A saved theme whose name and palette match an unmodified legacy built-in is refreshed to the
 * current built-in (or dropped if that built-in was removed/renamed); a theme the user edited or
 * authored is kept untouched; and any current built-in not already present is added. This lets
 * built-in palette updates reach existing configs without overwriting the user's own themes.
 * @param saved - The themes map from the loaded config.
 * @returns     The merged themes map.
 */
export function withBuiltinThemes(saved: Record<string, Theme>): Record<string, Theme> {
  const out: Record<string, Theme> = {};
  for (const [name, theme] of Object.entries(saved)) {
    const legacy = legacyBuiltinThemes[name];
    if (legacy && sameTheme(theme, legacy)) {
      continue; // unmodified legacy built-in — let the current built-ins below supply it
    }
    out[name] = theme; // user-edited built-in or a custom theme — keep as-is
  }
  for (const [name, theme] of Object.entries(builtinThemes)) {
    if (!Object.hasOwn(out, name)) {
      out[name] = theme.map((s) => ({ ...s }));
    }
  }
  return out;
}
