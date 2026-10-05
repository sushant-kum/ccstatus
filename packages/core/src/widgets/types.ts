import type { Item, WidgetType } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

export interface WidgetContext {
  snapshot: Snapshot;
  item: Item;
  commandOutputs: Record<string, string>;
}
export interface WidgetDef {
  type: WidgetType;
  label: string;
  format: (ctx: WidgetContext) => string | null;
}
