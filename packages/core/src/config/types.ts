import type { ColorIndex } from '../colors.js';
export type Align = 'left' | 'center' | 'right';
export type SeparatorMode = 'powerline' | 'space' | 'none';

// Single source of truth for the widget types. The `WidgetType` union and the
// runtime validator (validate.ts) both derive from this, so they cannot drift.
export const WIDGET_TYPES = [
  'model',
  'version',
  'context-length',
  'context-percentage',
  'tokens-input',
  'tokens-output',
  'tokens-cached',
  'tokens-total',
  'session-clock',
  'cwd',
  'git-branch',
  'git-changes',
  'git-worktree',
  'git-root-dir',
  'cost',
  'rate-limit-5h',
  'rate-limit-week',
  'block-timer',
  'session-usage',
  'weekly-usage',
  'reset-timer',
  'weekly-reset-timer',
  'context-bar',
  'context-remaining',
  'thinking-effort',
  'git-insertions',
  'git-deletions',
  'session-id',
  'context-window',
  'session-cost-rate',
  'git-sha',
  'output-style',
  'terminal-width',
  'custom-text',
  'custom-command',
  'flex-separator',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

// Widget types that render a data value and share the common styling fields.
export type DataWidgetType = Exclude<
  WidgetType,
  'custom-text' | 'custom-command' | 'flex-separator'
>;

// A single palette slot. Colors are xterm-256 indices (16–255). Both optional:
// bg-only → auto-contrast fg; fg-only → colored text, no block; neither → terminal default.
export interface PaletteSlot {
  fg?: ColorIndex;
  bg?: ColorIndex;
}

// Styling an item may carry. Colors are NOT here — they come from the theme palette by position.
export interface ItemStyle {
  merge?: boolean;
  align?: Align;
  rawValue?: boolean;
}

export type DataItem = ItemStyle & { id: string; type: DataWidgetType };
export type CustomTextItem = ItemStyle & { id: string; type: 'custom-text'; text: string };
export type CustomCommandItem = ItemStyle & { id: string; type: 'custom-command'; command: string };
export interface FlexSeparatorItem {
  id: string;
  type: 'flex-separator';
}

// Discriminated on `type`: per-widget data is expressed in the type system rather
// than hidden in an untyped metadata bag, so illegal items can't be constructed.
export type Item = DataItem | CustomTextItem | CustomCommandItem | FlexSeparatorItem;

// Items that carry styling (everything but the flex separator).
export type StylableItem = DataItem | CustomTextItem | CustomCommandItem;

export interface SurfaceLayout {
  enabled: boolean;
  lines: Item[][];
  linked?: boolean; // part of the single band/statusline/pane link group
}
export interface ToastRule {
  when: string;
  text: string;
  once?: boolean;
}
export interface ToastSurface {
  enabled: boolean;
  rules: ToastRule[];
}
// A theme is an ordered palette, cycled across visible items by position.
export type Theme = PaletteSlot[];
export interface Defaults {
  separator: SeparatorMode;
  padding: number;
  align: Align;
  glyph: string;
  invert: boolean;
  // When true, each positional cell (flex separators excepted) is padded to the widest cell at that
  // index across all lines of a surface, so cells line up into columns; content is justified within
  // its column by `align`.
  alignColumns: boolean;
}

export interface Config {
  version: 1;
  theme: string;
  themes: Record<string, Theme>;
  defaults: Defaults;
  surfaces: {
    band: SurfaceLayout;
    statusline: SurfaceLayout;
    pane: SurfaceLayout;
    toasts: ToastSurface;
  };
}
