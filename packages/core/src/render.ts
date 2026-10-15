import type { Config } from './config/types.js';
import { alignColumns, lineToCells } from './layout/cells.js';
import { composeLine } from './layout/compose.js';
import { assignPaletteColors } from './layout/palette.js';
import type { RenderModel } from './render-model.js';
import type { Snapshot } from './snapshot.js';

// Register all widgets (side-effect imports).
import './widgets/data-widgets.js';
import './widgets/git-widgets.js';
import './widgets/usage-widgets.js';
import './widgets/custom-widgets.js';

export interface RenderOptions {
  surface: 'band' | 'statusline' | 'pane';
  width: number;
  commandOutputs?: Record<string, string>;
}

/**
 * Renders a config and snapshot into a surface-agnostic model of styled segments.
 *
 * This is the single place where layout, powerline, and color are decided; every
 * host paints the resulting model.
 * @param config   - The active config describing the surfaces and styling.
 * @param snapshot - The live snapshot the widgets format from.
 * @param opts     - The surface to render, its width, and any cached command outputs.
 * @returns        The render model for the requested surface, or empty lines when it is disabled.
 */
export function render(config: Config, snapshot: Snapshot, opts: RenderOptions): RenderModel {
  const surface = config.surfaces[opts.surface];
  if (!surface.enabled) {
    return { lines: [] };
  }
  const outputs = opts.commandOutputs ?? {};
  // hasOwn guards against a hand-built Config whose active name is a prototype key
  // (e.g. "toString"), which bracket access would resolve to an inherited member.
  // An absent name or empty palette leaves the line uncolored, which is the intended
  // "no theme" behavior (see DEC-0020); loadConfig normally guarantees a valid own key.
  const theme = Object.hasOwn(config.themes, config.theme)
    ? (config.themes[config.theme] ?? [])
    : [];

  let lineCells = surface.lines
    .map((items) => lineToCells(items, config, snapshot, outputs))
    .filter((cells) => cells.length > 0);
  // Pad cells into shared visual columns across lines before coloring/composing, when enabled.
  // alignColumns groups merged runs so a merged pair counts as one column (see alignColumns, DEC-0032).
  if (config.defaults.alignColumns) {
    lineCells = alignColumns(lineCells, config.defaults.align);
  }
  const lines = lineCells
    .map((cells) => assignPaletteColors(cells, theme))
    .map((cells) => ({
      segments: composeLine(cells, config.defaults.separator, opts.width, config.defaults.glyph),
    }));

  return { lines };
}
