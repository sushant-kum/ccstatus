import type { RenderModel } from '@ccstatus/core';
import { rendererBg, rendererColor } from '@ccstatus/core';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
/**
 * Maps a core foreground colour name to Ink's colour name (delegates to core's `rendererColor`).
 * @param fg - The core foreground colour name, if any.
 * @returns  The Ink colour name, or undefined when no colour is given.
 */
export const inkColor = (fg?: string): string | undefined => rendererColor(fg);

/**
 * Maps a core background colour name to Ink's base colour name (delegates to core's `rendererBg`).
 * @param bg - The core background colour name, if any.
 * @returns  The Ink background colour name, or undefined when no colour is given.
 */
export const inkBg = (bg?: string): string | undefined => rendererBg(bg);

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
