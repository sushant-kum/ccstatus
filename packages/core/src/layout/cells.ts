import type { Config, Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';
import { resolveColors } from '../theme/themes.js';
import { registry } from '../widgets/registry.js';

export interface Cell {
  text: string;
  fg?: string;
  bg?: string;
  merge: boolean;
  flex: boolean;
}

/**
 * Formats a single item into a renderable cell, applying padding and resolved colors.
 * @param item           - The config item to render.
 * @param config         - The active config, used for padding and theme colors.
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
  const { fg, bg } = resolveColors(item, config);
  const merge = item.type === 'flex-separator' ? false : (item.merge ?? false);
  return { text: flex ? '' : `${pad}${value}${pad}`, fg, bg, merge, flex };
}

/**
 * Formats a line of items into cells, omitting items whose widgets return null.
 * @param items          - The config items on one line.
 * @param config         - The active config, used for padding and theme colors.
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
