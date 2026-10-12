import type { Theme } from '../config/types.js';
import { contrastFg } from '../theme/contrast.js';

import type { Cell } from './cells.js';

/**
 * Assigns palette colors to cells by position, cycling the palette. Merged cells reuse the preceding
 * slot (so a merged run is one color and the next independent cell keeps the correct slot); flex cells
 * stay uncolored and consume no slot. Pure: returns new cells and never mutates the input.
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
  for (const c of cells) {
    if (c.flex) {
      out.push({ ...c });
      continue;
    }
    if (!(c.merge && slot >= 0)) {
      slot += 1;
    }
    const pal = theme[slot % theme.length];
    const bg = pal?.bg;
    const fg = pal?.fg ?? (bg !== undefined ? contrastFg(bg) : undefined);
    out.push({ ...c, fg, bg });
  }
  return out;
}
