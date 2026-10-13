/** An xterm-256 palette index, integer 16–255. Mint only via `isColorIndex` or `asIndex`. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- conventional brand property name
export type ColorIndex = number & { readonly __colorIndex: unique symbol };

/**
 * Checks whether a value is a usable xterm-256 palette index (integer 16–255).
 * Indices 0–15 are excluded — Claude Code dims them in the status line.
 * @param x - The value to test.
 * @returns `true` when the value is an integer in 16–255.
 */
export function isColorIndex(x: unknown): x is ColorIndex {
  return typeof x === 'number' && Number.isInteger(x) && x >= 16 && x <= 255;
}

/**
 * Mint a ColorIndex from an authored constant known to be 16–255 (test-guarded, not runtime-validated).
 * @param n - The authored palette index.
 * @returns The branded index.
 */
export const asIndex = (n: number): ColorIndex => n as ColorIndex;
