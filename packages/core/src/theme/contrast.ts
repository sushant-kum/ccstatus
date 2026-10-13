import { BLACK, indexToRgb, WHITE } from './xterm256.js';

/**
 * Approximate luma threshold (0–255; Rec.709 coefficients applied to sRGB bytes, no gamma
 * correction): at or above → dark text, below → light text.
 */
const LUMA_THRESHOLD = 128;

/**
 * Returns a readable foreground index (black 16 or white 231) for a background index,
 * from the background's luminance. Used for palette slots that set a bg but no fg.
 * @param bg - The background palette index (16–255).
 * @returns  `16` (black) on light backgrounds, `231` (white) on dark ones.
 */
export function contrastFg(bg: number): number {
  const [r, g, b] = indexToRgb(bg);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma >= LUMA_THRESHOLD ? BLACK : WHITE;
}
