import type { Config } from './config/types.js'
import type { RenderModel } from './render-model.js'
import type { Snapshot } from './snapshot.js'
import { lineToCells } from './layout/cells.js'
import { composeLine } from './layout/compose.js'

// Register all widgets (side-effect imports).
import './widgets/data-widgets.js'
import './widgets/git-widgets.js'
import './widgets/usage-widgets.js'
import './widgets/custom-widgets.js'

export type RenderOptions = {
  surface: 'band' | 'statusline' | 'pane'
  width: number
  commandOutputs?: Record<string, string>
}

export function render(config: Config, snapshot: Snapshot, opts: RenderOptions): RenderModel {
  const surface = config.surfaces[opts.surface]
  if (!surface.enabled) return { lines: [] }
  const outputs = opts.commandOutputs ?? {}

  const lines = surface.lines
    .map(items => lineToCells(items, config, snapshot, outputs))
    .filter(cells => cells.length > 0)
    .map(cells => ({ segments: composeLine(cells, config.defaults.separator, opts.width) }))

  return { lines }
}
