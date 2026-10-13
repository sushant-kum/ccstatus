import type { ColorIndex } from './colors.js';
import { indexToHex } from './theme/xterm256.js';

/**
 * Maps a core foreground index to an Ink/chalk hex color.
 * @param fg - The foreground palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererColor = (fg?: ColorIndex): string | undefined =>
  fg === undefined ? undefined : indexToHex(fg);

/**
 * Maps a core background index to an Ink/chalk hex color.
 * @param bg - The background palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererBg = (bg?: ColorIndex): string | undefined =>
  bg === undefined ? undefined : indexToHex(bg);
