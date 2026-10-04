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
  const pad = flex ? '' : ' '.repeat(config.defaults.padding)
  const { fg, bg } = resolveColors(item, config)
  return { text: flex ? '' : `${pad}${value}${pad}`, fg, bg, merge: item.merge ?? false, flex }
}

export function lineToCells(
  items: Item[], config: Config, snapshot: Snapshot, commandOutputs: Record<string, string>,
): Cell[] {
  return items
    .map(it => itemToCell(it, config, snapshot, commandOutputs))
    .filter((c): c is Cell => c !== null)
}
