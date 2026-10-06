import type { Config, Item, Theme } from '../config/types.js';

/**
 * Resolves the foreground and background colors for an item from its style and the active theme.
 * @param item   - The item to resolve colors for.
 * @param config - The active config providing the current theme.
 * @returns      The resolved foreground and background color names, each possibly undefined.
 */
export function resolveColors(item: Item, config: Config): { fg?: string; bg?: string } {
  const themeEntry = config.themes[config.theme]?.[item.type];
  const fg = item.type === 'flex-separator' ? undefined : item.fg;
  const bg = item.type === 'flex-separator' ? undefined : item.bg;
  return {
    fg: fg ?? themeEntry?.fg,
    bg: bg ?? themeEntry?.bg,
  };
}

type P = [fg: string, bg: string];
// model, version, context-percentage, git-branch, git-changes, tokens-input, tokens-output, tokens-total
const WIDGETS = [
  'model',
  'version',
  'context-percentage',
  'git-branch',
  'git-changes',
  'tokens-input',
  'tokens-output',
  'tokens-total',
] as const;
const mk = (rows: P[]): Theme => {
  const t: Theme = {};
  WIDGETS.forEach((w, i) => {
    const row = rows[i];
    if (!row) {
      throw new Error(`theme definition is missing a color row for widget "${w}"`);
    }
    const [fg, bg] = row;
    t[w] = { fg, bg };
  });
  return t;
};

// Named-terminal-color approximations of ccstatusline's built-in palettes.
export const builtinThemes: Record<string, Theme> = {
  default: {
    model: { fg: 'black', bg: 'bgCyan' },
    version: { fg: 'white', bg: 'bgBlue' },
    'context-percentage': { fg: 'black', bg: 'bgBrightYellow' },
    'git-branch': { fg: 'black', bg: 'bgCyan' },
    'git-changes': { fg: 'white', bg: 'bgBrightBlack' },
  },
  classic: mk([
    ['black', 'bgYellow'],
    ['black', 'bgWhite'],
    ['black', 'bgGreen'],
    ['white', 'bgBlue'],
    ['black', 'bgMagenta'],
    ['black', 'bgCyan'],
    ['black', 'bgBrightYellow'],
    ['white', 'bgRed'],
  ]),
  nord: mk([
    ['black', 'bgBrightCyan'],
    ['black', 'bgCyan'],
    ['black', 'bgBlue'],
    ['white', 'bgBrightBlack'],
    ['black', 'bgBrightBlue'],
    ['black', 'bgGreen'],
    ['black', 'bgYellow'],
    ['white', 'bgBlack'],
  ]),
  dracula: mk([
    ['black', 'bgMagenta'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightCyan'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightRed'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgMagenta'],
  ]),
  gruvbox: mk([
    ['black', 'bgYellow'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgGreen'],
    ['black', 'bgCyan'],
    ['black', 'bgRed'],
    ['black', 'bgMagenta'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  monokai: mk([
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightCyan'],
    ['black', 'bgBrightRed'],
    ['white', 'bgBrightBlack'],
    ['black', 'bgYellow'],
    ['white', 'bgBlack'],
  ]),
  'one-dark': mk([
    ['black', 'bgBlue'],
    ['black', 'bgBrightBlue'],
    ['black', 'bgGreen'],
    ['black', 'bgMagenta'],
    ['black', 'bgYellow'],
    ['black', 'bgCyan'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  solarized: mk([
    ['white', 'bgBlue'],
    ['black', 'bgCyan'],
    ['black', 'bgYellow'],
    ['white', 'bgGreen'],
    ['white', 'bgMagenta'],
    ['white', 'bgRed'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
  'tokyo-night': mk([
    ['black', 'bgBrightBlue'],
    ['black', 'bgBlue'],
    ['black', 'bgBrightGreen'],
    ['black', 'bgBrightMagenta'],
    ['black', 'bgBrightYellow'],
    ['black', 'bgBrightCyan'],
    ['white', 'bgBrightBlack'],
    ['white', 'bgBlack'],
  ]),
};
