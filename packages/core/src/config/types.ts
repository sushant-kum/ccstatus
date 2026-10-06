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

// Styling common to every item except the flex separator (which has no content).
export interface ItemStyle {
  fg?: string;
  bg?: string;
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
export type Theme = Record<string, { fg?: string; bg?: string }>;
export interface Defaults {
  separator: SeparatorMode;
  padding: number;
  align: Align;
  glyph: string;
  invert: boolean;
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
