type Align = 'left' | 'center' | 'right';
type SeparatorMode = 'powerline' | 'space' | 'none';
declare const WIDGET_TYPES: readonly ["model", "version", "context-length", "context-percentage", "tokens-input", "tokens-output", "tokens-cached", "tokens-total", "session-clock", "cwd", "git-branch", "git-changes", "git-worktree", "git-root-dir", "cost", "rate-limit-5h", "rate-limit-week", "block-timer", "custom-text", "custom-command", "flex-separator"];
type WidgetType = typeof WIDGET_TYPES[number];
type DataWidgetType = Exclude<WidgetType, 'custom-text' | 'custom-command' | 'flex-separator'>;
type ItemStyle = {
    fg?: string;
    bg?: string;
    merge?: boolean;
    align?: Align;
    rawValue?: boolean;
};
type DataItem = ItemStyle & {
    id: string;
    type: DataWidgetType;
};
type CustomTextItem = ItemStyle & {
    id: string;
    type: 'custom-text';
    text: string;
};
type CustomCommandItem = ItemStyle & {
    id: string;
    type: 'custom-command';
    command: string;
};
type FlexSeparatorItem = {
    id: string;
    type: 'flex-separator';
};
type Item = DataItem | CustomTextItem | CustomCommandItem | FlexSeparatorItem;
type StylableItem = DataItem | CustomTextItem | CustomCommandItem;
type SurfaceLayout = {
    enabled: boolean;
    lines: Item[][];
};
type ToastRule = {
    when: string;
    text: string;
    once?: boolean;
};
type ToastSurface = {
    enabled: boolean;
    rules: ToastRule[];
};
type Theme = Record<string, {
    fg?: string;
    bg?: string;
}>;
type Defaults = {
    separator: SeparatorMode;
    padding: number;
    align: Align;
    glyph: string;
    invert: boolean;
};
type Config = {
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
};

type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
type Segment = {
    text: string;
    fg?: string;
    bg?: string;
    kind: SegmentKind;
};
type RenderLine = {
    segments: Segment[];
};
type RenderModel = {
    lines: RenderLine[];
};

type Snapshot = {
    version: string;
    model: string;
    effort: string | null;
    cwd: string;
    repo: boolean;
    gitRoot: string;
    gitBranch: string;
    gitWorktree: string;
    added: number;
    modified: number;
    deleted: number;
    ctxTokens: number;
    ctxPct: number;
    cached: number;
    input: number;
    output: number;
    total: number;
    startedAt: number;
    cost: number | null;
    fivePct: number | null;
    fiveReset: string | null;
    weekPct: number | null;
    weekReset: string | null;
    blockReset: string | null;
    terminalWidth: number;
    now: number;
};

type RenderOptions = {
    surface: 'band' | 'statusline' | 'pane';
    width: number;
    commandOutputs?: Record<string, string>;
};
declare function render(config: Config, snapshot: Snapshot, opts: RenderOptions): RenderModel;

declare function toAnsi(model: RenderModel): string;

declare function loadConfig(raw: unknown): {
    config: Config;
    warnings: string[];
};

declare const defaultConfig: Config;

declare function importCcstatusline(raw: unknown): {
    config: Config;
    warnings: string[];
};

type WidgetContext = {
    snapshot: Snapshot;
    item: Item;
    commandOutputs: Record<string, string>;
};
type WidgetDef = {
    type: WidgetType;
    label: string;
    format: (ctx: WidgetContext) => string | null;
};

declare const registry: Partial<Record<WidgetType, WidgetDef>>;
declare function register(def: WidgetDef): void;

declare const COLORS: ReadonlySet<string>;
declare function isColor(x: unknown): x is string;

declare const TOAST_FIELDS: Record<string, (s: Snapshot) => number | null>;
declare function isValidWhen(when: string): boolean;
declare function evalWhen(when: string, snapshot: Snapshot): boolean;

declare const builtinThemes: Record<string, Theme>;

export { type Align, COLORS, type Config, type CustomCommandItem, type CustomTextItem, type DataItem, type DataWidgetType, type Defaults, type FlexSeparatorItem, type Item, type ItemStyle, type RenderLine, type RenderModel, type RenderOptions, type Segment, type SegmentKind, type SeparatorMode, type Snapshot, type StylableItem, type SurfaceLayout, TOAST_FIELDS, type Theme, type ToastRule, type ToastSurface, type WidgetContext, type WidgetDef, type WidgetType, builtinThemes, defaultConfig, evalWhen, importCcstatusline, isColor, isValidWhen, loadConfig, register, registry, render, toAnsi };
