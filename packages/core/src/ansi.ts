import type { RenderModel, Segment } from './render-model.js';

/**
 * Serializes a styled segment to a 256-color SGR-wrapped string.
 * @param seg - The styled segment (fg/bg are xterm-256 indices).
 * @returns   The text wrapped in `38;5;`/`48;5;` codes, or plain text when it has no colors.
 */
function sgr(seg: Segment): string {
  const codes: string[] = [];
  if (seg.fg !== undefined) {
    codes.push(`\x1b[38;5;${seg.fg}m`);
  }
  if (seg.bg !== undefined) {
    codes.push(`\x1b[48;5;${seg.bg}m`);
  }
  if (!codes.length) {
    return seg.text;
  }
  return `${codes.join('')}${seg.text}\x1b[0m`;
}

/**
 * Serializes a render model into a 256-color ANSI string for the native status line.
 * @param model - The render model whose lines and segments are serialized.
 * @returns     The rendered lines joined by newlines, with each segment wrapped in ANSI color codes.
 */
export function toAnsi(model: RenderModel): string {
  return model.lines.map((line) => line.segments.map(sgr).join('')).join('\n');
}
