import type { WidgetType } from '../config/types.js'
import type { WidgetDef } from './types.js'

export const registry: Partial<Record<WidgetType, WidgetDef>> = {}
export function register(def: WidgetDef): void {
  registry[def.type] = def
}
