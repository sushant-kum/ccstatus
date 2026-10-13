import type { RenderModel } from '@ccstatus/core';
import { indexToHex } from '@ccstatus/core';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
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
            <Text
              key={j}
              color={s.fg === undefined ? undefined : indexToHex(s.fg)}
              backgroundColor={s.bg === undefined ? undefined : indexToHex(s.bg)}
            >
              {s.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
