import type { Config, Item } from '../config/types.js'
import type { Snapshot } from '../snapshot.js'
import { registry } from '../widgets/registry.js'
import { resolveColors } from '../theme/themes.js'

export type Cell = { text: string; fg?: string; bg?: string; merge: boolean; flex: boolean }

export function itemToCell(
  item: Item, config: Config, snapshot: Snapshot, commandOutputs: Record<string, string>,
): Cell | null {
  const def = registry[item.type]
  if (!def) return null
  const value = def.format({ snapshot, item, commandOutputs })
  if (value === null) return null

  const flex = item.type === 'flex-separator'
  // Defense in depth: the schema already clamps padding, but core must never throw
  // on a hand-constructed Config either (' '.repeat throws on negative counts).
  const pad = flex ? '' : ' '.repeat(Math.max(0, Math.floor(config.defaults.padding)))
  const { fg, bg } = resolveColors(item, config)
  const merge = item.type === 'flex-separator' ? false : (item.merge ?? false)
  return { text: flex ? '' : `${pad}${value}${pad}`, fg, bg, merge, flex }
}

export function lineToCells(
  items: Item[], config: Config, snapshot: Snapshot, commandOutputs: Record<string, string>,
): Cell[] {
  return items
    .map(it => itemToCell(it, config, snapshot, commandOutputs))
    .filter((c): c is Cell => c !== null)
}
