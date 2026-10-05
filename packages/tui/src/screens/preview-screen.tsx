import type { Config, Snapshot } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { Preview } from '../preview.js';

const SURFACES = ['band', 'statusline', 'pane'] as const;

/**
 * Renders the standalone preview screen with cycleable width and surface.
 * @param root0          - The screen props.
 * @param root0.config   - The config driving the bar.
 * @param root0.snapshot - The snapshot data to render against.
 * @param root0.source   - Whether the snapshot is live or the bundled sample.
 * @param root0.goHome   - Callback to return to the menu.
 * @returns              The preview screen element.
 */
export function PreviewScreen({
  config,
  snapshot,
  source,
  goHome,
}: {
  config: Config;
  snapshot: Snapshot;
  source: 'live' | 'sample';
  goHome: () => void;
}): ReactElement {
  const termWidth = process.stdout.columns || 120;
  const widths = [80, 120, 160, termWidth];
  const [wi, setWi] = useState(0);
  const [si, setSi] = useState(0);
  useInput((input, key) => {
    if (key.escape) {
      goHome();
    } else if (input === 'w') {
      setWi((v) => (v + 1) % widths.length);
    } else if (input === 's') {
      setSi((v) => (v + 1) % SURFACES.length);
    }
  });
  const width = widths[wi] ?? termWidth;
  const surface = SURFACES[si] ?? 'band';
  return (
    <Box flexDirection="column">
      <Text bold>Preview</Text>
      <Text color="gray">
        w width ({width}
        {wi === widths.length - 1 ? ' = terminal' : ''}) · s surface ({surface}) · esc back
      </Text>
      <Preview
        config={config}
        snapshot={snapshot}
        source={source}
        width={width}
        surface={surface}
      />
    </Box>
  );
}
