/**
 * Formats a number with a compact k/M suffix for values at or above 1,000.
 * @param n - The number to format.
 * @returns The compact string representation (e.g. `1.5k`, `2M`, or a plain rounded integer).
 */
export function fmtNum(n: number): string {
  const trim = (v: number, suffix: string): string =>
    `${v.toFixed(1).replace(/\.0$/, '')}${suffix}`;
  if (Math.abs(n) >= 1_000_000) {
    return trim(n / 1_000_000, 'M');
  }
  if (Math.abs(n) >= 1_000) {
    return trim(n / 1_000, 'k');
  }
  return String(Math.round(n));
}

/**
 * Formats a duration in milliseconds as a human-readable string.
 * @param ms - The duration in milliseconds (negative values are clamped to zero).
 * @returns  The duration formatted as hours/minutes, minutes/seconds, or seconds.
 */
export function fmtDur(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

/**
 * Formats a number as a rounded percentage string.
 * @param x - The percentage value to round.
 * @returns The value rounded to the nearest integer with a `%` suffix.
 */
export function pct(x: number): string {
  return `${Math.round(x)}%`;
}

/**
 * Renders a textual progress bar for a percentage value.
 * @param x     - The percentage to represent (clamped to the 0-100 range).
 * @param width - The total number of bar cells.
 * @returns     A string of filled and empty block characters of the given width.
 */
export function bar(x: number, width = 5): string {
  const filled = Math.floor((Math.min(100, Math.max(0, x)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
