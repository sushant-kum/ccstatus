import { indexToHex } from './theme/xterm256.js';

/**
 * Maps a core foreground index to an Ink/chalk hex color.
 * @param fg - The foreground palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererColor = (fg?: number): string | undefined =>
  fg === undefined ? undefined : indexToHex(fg);

/**
 * Maps a core background index to an Ink/chalk hex color.
 * @param bg - The background palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
export const rendererBg = (bg?: number): string | undefined =>
  bg === undefined ? undefined : indexToHex(bg);
