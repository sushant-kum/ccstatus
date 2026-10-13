/** An xterm-256 palette index, integer 16–255. Mint only via `isColorIndex` or `asIndex`. */
type ColorIndex = number & {
    readonly __colorIndex: unique symbol;
};
/**
 * Checks whether a value is a usable xterm-256 palette index (integer 16–255).
 * Indices 0–15 are excluded — Claude Code dims them in the status line.
 * @param x - The value to test.
 * @returns `true` when the value is an integer in 16–255.
 */
declare function isColorIndex(x: unknown): x is ColorIndex;
/**
 * Mint a ColorIndex from an authored constant known to be 16–255 (test-guarded, not runtime-validated).
 * @param n - The authored palette index.
 * @returns The branded index.
 */
declare const asIndex: (n: number) => ColorIndex;

type Align = 'left' | 'center' | 'right';
type SeparatorMode = 'powerline' | 'space' | 'none';
declare const WIDGET_TYPES: readonly ["model", "version", "context-length", "context-percentage", "tokens-input", "tokens-output", "tokens-cached", "tokens-total", "session-clock", "cwd", "git-branch", "git-changes", "git-worktree", "git-root-dir", "cost", "rate-limit-5h", "rate-limit-week", "block-timer", "session-usage", "weekly-usage", "reset-timer", "weekly-reset-timer", "context-bar", "context-remaining", "thinking-effort", "git-insertions", "git-deletions", "session-id", "context-window", "session-cost-rate", "git-sha", "output-style", "terminal-width", "custom-text", "custom-command", "flex-separator"];
type WidgetType = (typeof WIDGET_TYPES)[number];
type DataWidgetType = Exclude<WidgetType, 'custom-text' | 'custom-command' | 'flex-separator'>;
interface PaletteSlot {
    fg?: ColorIndex;
    bg?: ColorIndex;
}
interface ItemStyle {
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
    linked?: boolean;
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
type Theme = PaletteSlot[];
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
    fg?: ColorIndex;
    bg?: ColorIndex;
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
    insertions: number;
    deletions: number;
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
    sessionId: string;
    ctxWindow: number;
    gitSha: string;
    outputStyle: string | null;
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
 * Serializes a render model into a 256-color ANSI string for the native status line.
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

declare const LINKABLE: readonly ["band", "statusline", "pane"];
type LinkableSurface = (typeof LINKABLE)[number];
type Surfaces = Config['surfaces'];
/**
 * The linkable surfaces currently flagged `linked`, in canonical
 * band -> statusline -> pane order.
 * @param surfaces - The surfaces map.
 * @returns        The linked surfaces, canonical first.
 */
declare function linkedSurfaces(surfaces: Surfaces): LinkableSurface[];
/**
 * Writes `lines` to `surface` and, when it is linked, mirrors them to every other
 * linked member, returning a new surfaces map. This is the single chokepoint for
 * writing a linked surface's shared `lines`: callers route layout edits through it
 * instead of re-implementing the mirror loop, so no edit to a linked group's
 * content can leave it divergent. (Unlinking is a membership change, not a
 * shared-content write, and is handled by the caller.) Pure — the returned map and
 * every surface's `lines` in it are fresh deep copies that never alias the input.
 * See DEC-0019.
 * @param surfaces - The current surfaces map (not mutated).
 * @param surface  - The surface whose lines are being written.
 * @param lines    - The new lines for `surface`.
 * @returns        A new surfaces map with `surface` and any linked members updated.
 */
declare function writeLinkedLines(surfaces: Surfaces, surface: LinkableSurface, lines: Item[][]): Surfaces;

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

/**
 * Returns the sRGB bytes for an xterm-256 index in 16–255 (216-cube then 24-step grayscale).
 * @param idx - The palette index (clamped to 16–255 defensively).
 * @returns   The [r, g, b] bytes, each 0–255.
 */
declare function indexToRgb(idx: ColorIndex): [number, number, number];
/**
 * Returns the `#rrggbb` hex string for an xterm-256 index, for Ink's color props.
 * @param i - The palette index (16–255).
 * @returns The lowercase 6-digit hex color.
 */
declare function indexToHex(i: ColorIndex): string;

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

/**
 * Maps a core foreground index to an Ink/chalk hex color.
 * @param fg - The foreground palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
declare const rendererColor: (fg?: ColorIndex) => string | undefined;
/**
 * Maps a core background index to an Ink/chalk hex color.
 * @param bg - The background palette index, if any.
 * @returns  The `#rrggbb` hex, or undefined when no color is given.
 */
declare const rendererBg: (bg?: ColorIndex) => string | undefined;

export { type Align, type ColorIndex, type Config, type CustomCommandItem, type CustomTextItem, type DataItem, type DataWidgetType, type Defaults, type FlexSeparatorItem, type Item, type ItemStyle, LINKABLE, type LinkableSurface, type PaletteSlot, type RenderLine, type RenderModel, type RenderOptions, type Segment, type SegmentKind, type SeparatorMode, type Snapshot, type StylableItem, type SurfaceLayout, TOAST_FIELDS, type Theme, type ToastRule, type ToastSurface, type WidgetContext, type WidgetDef, type WidgetType, asIndex, builtinThemes, defaultConfig, evalWhen, importCcstatusline, indexToHex, indexToRgb, isColorIndex, isValidWhen, linkedSurfaces, loadConfig, register, registry, render, rendererBg, rendererColor, toAnsi, writeLinkedLines };
