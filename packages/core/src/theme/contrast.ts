// Named-background → readable foreground, for palette slots that give a background but no explicit
// foreground. Backgrounds are named terminal colors (DEC-0005), so contrast is a fixed lookup, not a
// luminance computation.

// Base color names (bg-prefix stripped) whose backgrounds are light enough to need black text.
const LIGHT_BG = new Set<string>([
  'green',
  'yellow',
  'cyan',
  'white',
  'brightGreen',
  'brightYellow',
  'brightCyan',
  'brightWhite',
]);

const baseColor = (bg: string): string => {
  if (!bg.startsWith('bg')) {
    return bg;
  }
  const rest = bg.slice(2);
  return rest.charAt(0).toLowerCase() + rest.slice(1);
};

/**
 * Returns a readable foreground color name for a named background.
 *
 * Dark backgrounds get "brightWhite" (SGR 97), not "white" (SGR 37): most terminals
 * render plain "white" as a dim light-grey, which is low-contrast on dark — and barely
 * readable on a grey like bgBrightBlack. "brightWhite" is crisp. See DEC-0022.
 * @param bg - A background color name (e.g. "bgCyan", "bgBrightBlack").
 * @returns  "black" on light backgrounds, "brightWhite" on dark ones.
 */
export function contrastFg(bg: string): string {
  return LIGHT_BG.has(baseColor(bg)) ? 'black' : 'brightWhite';
}
