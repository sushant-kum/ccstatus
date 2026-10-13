/**
 * Checks whether a value is a usable xterm-256 palette index (integer 16–255).
 * Indices 0–15 are excluded — Claude Code dims them in the status line.
 * @param x - The value to test.
 * @returns `true` when the value is an integer in 16–255.
 */
export function isColorIndex(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 16 && x <= 255;
}
