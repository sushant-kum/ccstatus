// Core uses brightX / bgX / bgBrightX. Ink (chalk) wants x / xBright and adds the
// bg prefix itself. The engine's Text is Ink's too, so both hosts share this.
/**
 * Converts a core colour name to Ink/chalk order (brightX becomes xBright).
 * @param n - The core colour name, if any.
 * @returns The Ink colour name, or undefined when no colour is given.
 */
const toInk = (n?: string): string | undefined => {
  if (!n) {
    return undefined;
  }
  return n.startsWith('bright') ? (n[6] ?? '').toLowerCase() + n.slice(7) + 'Bright' : n;
};

/**
 * Maps a core foreground colour name to the renderer's (Ink/chalk) colour name.
 * @param fg - The core foreground colour name, if any.
 * @returns  The renderer colour name, or undefined when no colour is given.
 */
export const rendererColor = (fg?: string): string | undefined => toInk(fg);

/**
 * Maps a core background colour name to the renderer's base colour name.
 * @param bg - The core background colour name, if any.
 * @returns  The renderer background colour name, or undefined when no colour is given.
 */
export const rendererBg = (bg?: string): string | undefined => {
  if (!bg) {
    return undefined;
  }
  return toInk(bg.startsWith('bg') ? (bg[2] ?? '').toLowerCase() + bg.slice(3) : bg);
};
