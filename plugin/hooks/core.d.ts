type Align = 'left' | 'center' | 'right';
type SeparatorMode = 'powerline' | 'space' | 'none';
declare const WIDGET_TYPES: readonly ["model", "version", "context-length", "context-percentage", "tokens-input", "tokens-output", "tokens-cached", "tokens-total", "session-clock", "cwd", "git-branch", "git-changes", "git-worktree", "git-root-dir", "cost", "rate-limit-5h", "rate-limit-week", "block-timer", "custom-text", "custom-command", "flex-separator"];
type WidgetType = (typeof WIDGET_TYPES)[number];
type DataWidgetType = Exclude<WidgetType, 'custom-text' | 'custom-command' | 'flex-separator'>;
interface ItemStyle {
    fg?: string;
    bg?: string;
    merge?: boolean;
    align?: Align;
    rawValue?: boolean;
}
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
interface FlexSeparatorItem {
    id: string;
    type: 'flex-separator';
}
type Item = DataItem | CustomTextItem | CustomCommandItem | FlexSeparatorItem;
type StylableItem = DataItem | CustomTextItem | CustomCommandItem;
interface SurfaceLayout {
    enabled: boolean;
    lines: Item[][];
}
interface ToastRule {
    when: string;
    text: string;
    once?: boolean;
}
interface ToastSurface {
    enabled: boolean;
    rules: ToastRule[];
}
type Theme = Record<string, {
    fg?: string;
    bg?: string;
}>;
interface Defaults {
    separator: SeparatorMode;
    padding: number;
    align: Align;
    glyph: string;
    invert: boolean;
}
interface Config {
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

type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
interface Segment {
    text: string;
    fg?: string;
    bg?: string;
    kind: SegmentKind;
}
interface RenderLine {
    segments: Segment[];
}
interface RenderModel {
    lines: RenderLine[];
}

interface Snapshot {
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
}

interface RenderOptions {
    surface: 'band' | 'statusline' | 'pane';
    width: number;
    commandOutputs?: Record<string, string>;
}
/**
 * Renders a config and snapshot into a surface-agnostic model of styled segments.
 *
 * This is the single place where layout, powerline, and color are decided; every
 * host paints the resulting model.
 * @param config   - The active config describing the surfaces and styling.
 * @param snapshot - The live snapshot the widgets format from.
 * @param opts     - The surface to render, its width, and any cached command outputs.
 * @returns        The render model for the requested surface, or empty lines when it is disabled.
 */
declare function render(config: Config, snapshot: Snapshot, opts: RenderOptions): RenderModel;

/**
 * Serializes a render model into an ANSI string for the native status line.
 * @param model - The render model whose lines and segments are serialized.
 * @returns     The rendered lines joined by newlines, with each segment wrapped in ANSI color codes.
 */
declare function toAnsi(model: RenderModel): string;

/**
 * Validates, migrates, and fills defaults for an untrusted config, never throwing.
 *
 * Invalid items, colors, and toast rules are dropped with warnings; a wholly
 * invalid config falls back to the defaults.
 * @param raw - The untrusted, parsed config value.
 * @returns   The safe, fully-populated config along with any warnings produced.
 */
declare function loadConfig(raw: unknown): {
    config: Config;
    warnings: string[];
};

declare const defaultConfig: Config;

/**
 * Converts a ccstatusline config into a ccstatus config, mapping known widgets and dropping the rest.
 * @param raw - The parsed ccstatusline config, or any value when the input is untrusted.
 * @returns   The resulting ccstatus config along with warnings for anything that could not be mapped.
 */
declare function importCcstatusline(raw: unknown): {
    config: Config;
    warnings: string[];
};

interface WidgetContext {
    snapshot: Snapshot;
    item: Item;
    commandOutputs: Record<string, string>;
}
interface WidgetDef {
    type: WidgetType;
    label: string;
    format: (ctx: WidgetContext) => string | null;
}

declare const registry: Partial<Record<WidgetType, WidgetDef>>;
/**
 * Registers a widget definition into the shared registry, keyed by its type.
 * @param def - The widget definition to register.
 */
declare function register(def: WidgetDef): void;

declare const COLORS: ReadonlySet<string>;
/**
 * Checks whether a value is one of the supported named terminal colors.
 * @param x - The value to test.
 * @returns `true` when the value is a string naming a known color.
 */
declare function isColor(x: unknown): x is string;

declare const TOAST_FIELDS: Record<string, (s: Snapshot) => number | null>;
/**
 * Reports whether a toast `when` rule parses and names a known snapshot field.
 *
 * Used everywhere a rule is authored or checked, so "valid in the TUI" matches
 * "fires in the plugin".
 * @param when - The `when` expression to validate.
 * @returns    `true` when the expression is well-formed and references a known field.
 */
declare function isValidWhen(when: string): boolean;
/**
 * Evaluates a toast `when` rule against a snapshot.
 * @param when     - The `when` expression to evaluate.
 * @param snapshot - The snapshot providing the field values.
 * @returns        `true` when the expression is valid and its comparison holds for the snapshot.
 */
declare function evalWhen(when: string, snapshot: Snapshot): boolean;

declare const builtinThemes: Record<string, Theme>;

export { type Align, COLORS, type Config, type CustomCommandItem, type CustomTextItem, type DataItem, type DataWidgetType, type Defaults, type FlexSeparatorItem, type Item, type ItemStyle, type RenderLine, type RenderModel, type RenderOptions, type Segment, type SegmentKind, type SeparatorMode, type Snapshot, type StylableItem, type SurfaceLayout, TOAST_FIELDS, type Theme, type ToastRule, type ToastSurface, type WidgetContext, type WidgetDef, type WidgetType, builtinThemes, defaultConfig, evalWhen, importCcstatusline, isColor, isValidWhen, loadConfig, register, registry, render, toAnsi };
