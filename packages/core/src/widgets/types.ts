import type { Snapshot } from '../snapshot.js'
import type { Item, WidgetType } from '../config/types.js'

export type WidgetContext = {
  snapshot: Snapshot
  item: Item
  commandOutputs: Record<string, string>
}
export type WidgetDef = {
  type: WidgetType
  label: string
  format: (ctx: WidgetContext) => string | null
}
