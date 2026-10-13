// Single source of truth for the xterm-256 palette: index → RGB, index → hex, and the
// legacy-name → index migration table. Indices 0–15 dim in the status line, so the palette
// is 16–255; this module is written for that range (0–15 never reach it — validation keeps
// them out, and the migration table maps them to fixed 256-color (cube or grayscale) equivalents).

import { asIndex } from '../colors.js';
import type { ColorIndex } from '../colors.js';

/** Pure black (cube) and pure white (cube) — the auto-contrast foreground choices. */
export const BLACK: ColorIndex = asIndex(16);
export const WHITE: ColorIndex = asIndex(231);

const LEVEL = [0, 95, 135, 175, 215, 255] as const;

/**
 * Returns the sRGB bytes for an xterm-256 index in 16–255 (216-cube then 24-step grayscale).
 * @param idx - The palette index (clamped to 16–255 defensively).
 * @returns   The [r, g, b] bytes, each 0–255.
 */
export function indexToRgb(idx: ColorIndex): [number, number, number] {
  const i = Math.min(255, Math.max(16, Math.round(idx)));
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
export function indexToHex(i: ColorIndex): string {
  const [r, g, b] = indexToRgb(i);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/**
 * Legacy chalk-style color names → xterm-256 index (all in 16–255, avoiding the dimmed 0–15).
 * `bg`-prefixed names map to the same index as their base (fg/bg is now a field, not a prefix).
 */
export const NAMED_INDEX: ReadonlyMap<string, ColorIndex> = new Map([
  ['black', asIndex(16)],
  ['brightBlack', asIndex(240)],
  ['gray', asIndex(240)],
  ['red', asIndex(160)],
  ['brightRed', asIndex(196)],
  ['green', asIndex(40)],
  ['brightGreen', asIndex(46)],
  ['yellow', asIndex(184)],
  ['brightYellow', asIndex(226)],
  ['blue', asIndex(20)],
  ['brightBlue', asIndex(21)],
  ['magenta', asIndex(164)],
  ['brightMagenta', asIndex(201)],
  ['cyan', asIndex(44)],
  ['brightCyan', asIndex(51)],
  ['white', asIndex(250)],
  ['brightWhite', asIndex(231)],
]);
