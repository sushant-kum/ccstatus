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
