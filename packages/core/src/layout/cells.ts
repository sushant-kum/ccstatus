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
 * Decides whether the cell at `index` folds into its predecessor when a line is composed. A cell
 * merges when it is flagged `merge`, is not the first cell, is not itself a flex separator, and its
 * immediate predecessor is a non-flex cell (flex separators absorb slack and never receive a merge).
 *
 * This is the single definition of the merge rule: `composeLine`'s `mergeCells` concatenates on it
 * and `alignColumns` groups cells into visual columns by it, so the two cannot drift apart.
 * @param cells - The cells of one line, in order.
 * @param index - The position of the cell to test.
 * @returns     `true` when the cell concatenates into the preceding cell.
 */
export function willMerge(cells: Cell[], index: number): boolean {
  const cell = cells[index];
  if (!cell || !cell.merge || cell.flex || index === 0) {
    return false;
  }
  return !(cells[index - 1]?.flex ?? true);
}

/**
 * Groups a line's cells into visual columns: a lead cell plus the cells that `willMerge` into it.
 * `composeLine` later concatenates each such run into a single rendered cell, so a merged pair is one
 * visual column, not two. A flex separator is always its own singleton run.
 * @param cells - The cells of one line, in order.
 * @returns     The runs, each an ordered slice of the input cells.
 */
function groupRuns(cells: Cell[]): Cell[][] {
  const runs: Cell[][] = [];
  cells.forEach((c, i) => {
    const run = runs[runs.length - 1];
    if (run && willMerge(cells, i)) {
      run.push(c);
    } else {
      runs.push([c]);
    }
  });
  return runs;
}

/**
 * Aligns cells into columns across lines by **visual** column — the rendered cells left after merging,
 * not the raw item positions. Each line is grouped into runs (`groupRuns`); a run's width is the sum
 * of its members (merged members concatenate with no separator). Every run is padded to the widest run
 * at its visual-column index across all lines, justified by `align`, so a merged pair sets its column's
 * width and sibling cells span the full width — and items after a merge still line up though the merge
 * shifted their raw index.
 *
 * Padding lands on a run's edge members (lead takes the left pad, last takes the right pad), so members
 * stay contiguous and a merged run reads as one block; each pad takes its member's own palette slot (a
 * merged member shares the preceding slot — DEC-0020). Flex runs are returned unpadded (they absorb
 * slack in `composeLine`). The result is a flat cell list per line in the original order, so palette
 * assignment and `composeLine` see an unchanged cell sequence. Inputs are not mutated.
 * @param lines - The per-line cells of one surface.
 * @param align - How to justify each run's content within its column.
 * @returns     The lines with their cells padded to shared visual-column widths.
 */
export function alignColumns(lines: Cell[][], align: Align): Cell[][] {
  const runWidth = (run: Cell[]): number => run.reduce((n, c) => n + c.text.length, 0);
  const isFlexRun = (run: Cell[]): boolean => run.length === 1 && (run[0]?.flex ?? false);
  const lineRuns = lines.map(groupRuns);

  const widths: number[] = [];
  for (const runs of lineRuns) {
    runs.forEach((run, j) => {
      if (!isFlexRun(run)) {
        widths[j] = Math.max(widths[j] ?? 0, runWidth(run));
      }
    });
  }

  return lineRuns.map((runs) =>
    runs.flatMap((run, j) => {
      if (isFlexRun(run)) {
        return run.map((c) => ({ ...c }));
      }
      const deficit = (widths[j] ?? runWidth(run)) - runWidth(run);
      const leftPad =
        deficit <= 0
          ? 0
          : align === 'right'
            ? deficit
            : align === 'center'
              ? Math.floor(deficit / 2)
              : 0;
      const rightPad = deficit <= 0 ? 0 : deficit - leftPad;
      return run.map((c, k) => {
        const lead = k === 0 ? ' '.repeat(leftPad) : '';
        const tail = k === run.length - 1 ? ' '.repeat(rightPad) : '';
        return { ...c, text: `${lead}${c.text}${tail}` };
      });
    })
  );
}
