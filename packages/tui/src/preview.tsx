import { render as renderBar } from '@ccstatus/core';
import type { Config, Snapshot } from '@ccstatus/core';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { paintModel } from './paint.js';
/**
 * Renders the live bar preview for a surface, bordered and labelled.
 * @param root0          - The preview props.
 * @param root0.config   - The config driving the bar.
 * @param root0.snapshot - The snapshot data to render against.
 * @param root0.source   - Whether the snapshot is live or the bundled sample.
 * @param root0.width    - The width in columns to render at.
 * @param root0.surface  - The surface to render (defaults to 'band').
 * @returns              The Ink element tree for the preview.
 */
export function Preview({
  config,
  snapshot,
  source,
  width,
  surface = 'band',
}: {
  config: Config;
  snapshot: Snapshot;
  source: 'live' | 'sample';
  width: number;
  surface?: 'band' | 'statusline' | 'pane';
}): ReactElement {
  const model = renderBar(config, snapshot, { surface, width });
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray">
        live preview · {surface} · {width} cols · {source} data
      </Text>
      {paintModel(model)}
    </Box>
  );
}
