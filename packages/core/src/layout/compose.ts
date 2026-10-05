import type { SeparatorMode } from '../config/types.js';
import type { Segment } from '../render-model.js';

import type { Cell } from './cells.js';

/**
 * Converts a background color name into the matching foreground color name.
 * @param bg - The background color name, or `undefined`.
 * @returns  The corresponding foreground color name, or `undefined` when no background is given.
 */
function bgToFg(bg: string | undefined): string | undefined {
  if (!bg) {
    return undefined;
  }
  if (!bg.startsWith('bg')) {
    return bg;
  }
  const rest = bg.slice(2);
  return rest.charAt(0).toLowerCase() + rest.slice(1);
}

/**
 * Concatenates adjacent cells flagged to merge into their predecessor.
 * @param cells - The cells to merge, in order.
 * @returns     A new array of cells with mergeable cells folded into the preceding cell.
 */
function mergeCells(cells: Cell[]): Cell[] {
  const out: Cell[] = [];
  for (const c of cells) {
    const prev = out[out.length - 1];
    if (c.merge && prev && !prev.flex && !c.flex) {
      prev.text = `${prev.text}${c.text}`;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * Truncates a line of segments to fit a width, dropping powerline caps first.
 * @param segs  - The composed segments for one line.
 * @param width - The maximum total text width in columns.
 * @returns     The segments trimmed so their combined text fits within the width.
 */
function truncate(segs: Segment[], width: number): Segment[] {
  const total = segs.reduce((n, s) => n + s.text.length, 0);
  if (total <= width) {
    return segs;
  }
  let budget = width;
  const out: Segment[] = [];
  for (const s of segs) {
    if (s.kind === 'cap') {
      continue;
    } // drop caps first under pressure
    if (budget <= 0) {
      break;
    }
    if (s.text.length <= budget) {
      out.push(s);
      budget -= s.text.length;
    } else {
      out.push({ ...s, text: s.text.slice(0, budget) });
      budget = 0;
    }
  }
  return out;
}

/**
 * Composes cells into a line of styled segments with separators, caps, and flex spacing.
 * @param cells - The cells to lay out, in order.
 * @param mode  - The separator style between cells.
 * @param width - The target line width in columns.
 * @param glyph - The glyph used for powerline separators and caps.
 * @returns     The composed segments, truncated to the given width.
 */
export function composeLine(
  cells: Cell[],
  mode: SeparatorMode,
  width: number,
  glyph = '▒'
): Segment[] {
  const merged = mergeCells(cells);
  const content = merged.filter((c) => !c.flex);
  const flexCount = merged.filter((c) => c.flex).length;

  // width taken by content + separators/caps
  const contentWidth = content.reduce((n, c) => n + c.text.length, 0);
  let sepWidth = 0;
  if (mode === 'powerline') {
    sepWidth = Math.max(0, content.length - 1) + (content.length ? 2 : 0);
  } else if (mode === 'space') {
    sepWidth = Math.max(0, content.length - 1);
  }
  const leftover = Math.max(0, width - contentWidth - sepWidth);
  const per = flexCount ? Math.floor(leftover / flexCount) : 0;
  let extra = flexCount ? leftover - per * flexCount : 0;
  const flexWidth = (): number => {
    const w = per + (extra > 0 ? 1 : 0);
    if (extra > 0) {
      extra -= 1;
    }
    return w;
  };

  const segs: Segment[] = [];
  const emitStartCap = mode === 'powerline' && content.length > 0;
  if (emitStartCap) {
    segs.push({ kind: 'cap', text: glyph, fg: bgToFg(content[0]?.bg) });
  }

  let ci = 0;
  for (const c of merged) {
    if (c.flex) {
      segs.push({ kind: 'flex', text: ' '.repeat(flexWidth()) });
      continue;
    }
    segs.push({ kind: 'cell', text: c.text, fg: c.fg, bg: c.bg });
    const isLast = ci === content.length - 1;
    const next = content[ci + 1];
    if (!isLast && next) {
      if (mode === 'powerline') {
        segs.push({ kind: 'separator', text: glyph, fg: bgToFg(c.bg), bg: next.bg });
      } else if (mode === 'space') {
        segs.push({ kind: 'separator', text: ' ' });
      }
    }
    ci += 1;
  }
  if (emitStartCap) {
    segs.push({ kind: 'cap', text: glyph, fg: bgToFg(content[content.length - 1]?.bg) });
  }

  return truncate(segs, width);
}
