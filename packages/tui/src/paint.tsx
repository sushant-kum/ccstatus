import type { RenderModel } from '@ccstatus/core';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
// core uses brightX / bgX / bgBrightX; Ink (chalk) wants x / xBright and adds the bg prefix itself.
const toInk = (n?: string): string | undefined => {
  if (!n) {
    return undefined;
  }
  return n.startsWith('bright') ? (n[6] ?? '').toLowerCase() + n.slice(7) + 'Bright' : n;
};

/**
 * Maps a core foreground color name to Ink/chalk's color name.
 * @param fg - The core foreground color name, if any.
 * @returns  The Ink color name, or undefined when no color is given.
 */
export const inkColor = (fg?: string): string | undefined => toInk(fg);

/**
 * Maps a core background color name to Ink/chalk's base color name.
 * @param bg - The core background color name, if any.
 * @returns  The Ink background color name, or undefined when no color is given.
 */
export const inkBg = (bg?: string): string | undefined => {
  if (!bg) {
    return undefined;
  }
  return toInk(bg.startsWith('bg') ? (bg[2] ?? '').toLowerCase() + bg.slice(3) : bg);
};

/**
 * Renders a core RenderModel as Ink Box/Text elements.
 * @param model - The surface-agnostic render model to paint.
 * @returns     The Ink element tree for the model.
 */
export function paintModel(model: RenderModel): ReactElement {
  return (
    <Box flexDirection="column">
      {model.lines.map((line, i) => (
        <Box key={i}>
          {line.segments.map((s, j) => (
            <Text key={j} color={inkColor(s.fg)} backgroundColor={inkBg(s.bg)}>
              {s.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
