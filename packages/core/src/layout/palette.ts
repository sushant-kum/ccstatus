import type { Theme } from '../config/types.js';
import { contrastFg } from '../theme/contrast.js';

import type { Cell } from './cells.js';

/**
 * Assigns palette colors to cells by position, cycling the palette. A merged cell reuses the
 * immediately-preceding cell's slot, but only when that cell is not a flex separator (a merge right
 * after a flex starts a new slot), so a merged run is one color and the next independent cell keeps
 * the correct slot; flex cells stay uncolored and consume no slot. Pure: returns new cells and never
 * mutates the input.
 * @param cells - The cells for one line, in order (nulls already dropped, not yet merged).
 * @param theme - The active palette; an empty palette leaves every cell uncolored.
 * @returns     New cells with fg/bg filled from the palette.
 */
export function assignPaletteColors(cells: Cell[], theme: Theme): Cell[] {
  if (theme.length === 0) {
    return cells.map((c) => ({ ...c }));
  }
  const out: Cell[] = [];
  let slot = -1;
  let prev: Cell | undefined;
  for (const c of cells) {
    if (c.flex) {
      out.push({ ...c });
      prev = c;
      continue;
    }
    const continuation = c.merge === true && prev !== undefined && !prev.flex;
    if (!continuation) {
      slot += 1;
    }
    const pal = theme[slot % theme.length];
    const bg = pal?.bg;
    const fg = pal?.fg ?? (bg !== undefined ? contrastFg(bg) : undefined);
    out.push({ ...c, fg, bg });
    prev = c;
  }
  return out;
}
