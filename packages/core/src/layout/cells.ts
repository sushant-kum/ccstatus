import type { ColorIndex } from '../colors.js';
import type { Align, Config, Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';
import { registry } from '../widgets/registry.js';

export interface Cell {
  text: string;
  fg?: ColorIndex;
  bg?: ColorIndex;
  merge: boolean;
  flex: boolean;
}

/**
 * Formats a single item into a renderable cell, applying padding. Palette colors are assigned
 * later, by position, in `assignPaletteColors`; a cell leaves this function uncolored.
 * @param item           - The config item to render.
 * @param config         - The active config, used for padding.
 * @param snapshot       - The live snapshot the widget formats from.
 * @param commandOutputs - Cached outputs for custom-command widgets, keyed by item id.
 * @returns              The rendered cell, or `null` when the widget omits itself.
 */
export function itemToCell(
  item: Item,
  config: Config,
  snapshot: Snapshot,
  commandOutputs: Record<string, string>
): Cell | null {
  const def = registry[item.type];
  if (!def) {
    return null;
  }
  const value = def.format({ snapshot, item, commandOutputs });
  if (value === null) {
    return null;
  }

  const flex = item.type === 'flex-separator';
  // Defense in depth: the schema already clamps padding, but core must never throw
  // on a hand-constructed Config either (' '.repeat throws on negative counts).
  const pad = flex ? '' : ' '.repeat(Math.max(0, Math.floor(config.defaults.padding)));
  const merge = item.type === 'flex-separator' ? false : (item.merge ?? false);
  return { text: flex ? '' : `${pad}${value}${pad}`, merge, flex };
}

/**
 * Formats a line of items into cells, omitting items whose widgets return null.
 * @param items          - The config items on one line.
 * @param config         - The active config, used for padding.
 * @param snapshot       - The live snapshot the widgets format from.
 * @param commandOutputs - Cached outputs for custom-command widgets, keyed by item id.
 * @returns              The rendered cells for the line, in order.
 */
export function lineToCells(
  items: Item[],
  config: Config,
  snapshot: Snapshot,
  commandOutputs: Record<string, string>
): Cell[] {
  return items
    .map((it) => itemToCell(it, config, snapshot, commandOutputs))
    .filter((c): c is Cell => c !== null);
}

/**
 * Pads `text` to `width` columns, justifying by `align` (falls back to left).
 * @param text  - The cell text.
 * @param width - The target column width.
 * @param align - Where the content sits within the column.
 * @returns     The padded text (unchanged when already at/over width).
 */
function justify(text: string, width: number, align: Align): string {
  const deficit = width - text.length;
  if (deficit <= 0) {
    return text;
  }
  if (align === 'right') {
    return ' '.repeat(deficit) + text;
  }
  if (align === 'center') {
    const left = Math.floor(deficit / 2);
    return ' '.repeat(left) + text + ' '.repeat(deficit - left);
  }
  return text + ' '.repeat(deficit);
}

/**
 * Aligns cells into columns across lines: each positional (non-flex) cell is padded to the widest
 * cell at that index across every line, with content justified by `align`. Flex separators are left
 * untouched (they absorb slack in `composeLine`).
 *
 * A cell that will merge into its predecessor loses the separator other rows have at that boundary
 * (`composeLine` concatenates merged text directly), which would shift that column and everything
 * after it left by `sepWidth`. Such a cell prepends `sepWidth` spaces to fill the gap, so columns
 * stay aligned across rows whether or not a row merges there. Returns new cell arrays; inputs are
 * not mutated.
 * @param lines    - The per-line cells of one surface.
 * @param align    - How to justify each cell's content within its column.
 * @param sepWidth - The width of one inter-cell separator (0 for `none`, else 1).
 * @returns        The lines with their cells padded to shared column widths.
 */
export function alignColumns(lines: Cell[][], align: Align, sepWidth: number): Cell[][] {
  const widths: number[] = [];
  for (const cells of lines) {
    cells.forEach((c, i) => {
      if (!c.flex) {
        widths[i] = Math.max(widths[i] ?? 0, c.text.length);
      }
    });
  }
  return lines.map((cells) =>
    cells.map((c, i) => {
      if (c.flex) {
        return c;
      }
      const padded = justify(c.text, widths[i] ?? c.text.length, align);
      // Mirror composeLine's merge rule: a merge cell folds into a non-flex predecessor, dropping
      // the separator between them — prepend that width so the column still lines up.
      const merges = c.merge && i > 0 && !(cells[i - 1]?.flex ?? true);
      return { ...c, text: merges ? ' '.repeat(sepWidth) + padded : padded };
    })
  );
}
