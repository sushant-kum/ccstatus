import type { WidgetType } from '../config/types.js';

import type { WidgetDef } from './types.js';

export const registry: Partial<Record<WidgetType, WidgetDef>> = {};
/**
 * Registers a widget definition into the shared registry, keyed by its type.
 * @param def - The widget definition to register.
 */
export function register(def: WidgetDef): void {
  registry[def.type] = def;
}
