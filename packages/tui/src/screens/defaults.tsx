import type { SeparatorMode } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';

const SEPARATORS: SeparatorMode[] = ['powerline', 'space', 'none'];
const FIELDS = ['separator', 'padding'] as const;

/**
 * Renders the global defaults screen for editing separator and padding.
 * @param root0           - The screen props.
 * @param root0.config    - The current config.
 * @param root0.setConfig - Callback to replace the config immutably.
 * @param root0.goHome    - Callback to return to the menu.
 * @returns               The defaults screen element.
 */
export function Defaults({ config, setConfig, goHome }: ScreenProps): ReactElement {
  const [focus, setFocus] = useState(0);
  const d = config.defaults;
  const cycle = (dir: 1 | -1): void => {
    const field = FIELDS[focus];
    if (field === 'separator') {
      const i = SEPARATORS.indexOf(d.separator);
      const next = SEPARATORS[(i + dir + SEPARATORS.length) % SEPARATORS.length] ?? d.separator;
      setConfig({ ...config, defaults: { ...d, separator: next } });
    } else {
      const next = Math.min(4, Math.max(0, d.padding + dir));
      if (next !== d.padding) {
        setConfig({ ...config, defaults: { ...d, padding: next } });
      }
    }
  };
  useInput((_i, key) => {
    if (key.escape) {
      goHome();
    } else if (key.upArrow) {
      setFocus((f) => Math.max(0, f - 1));
    } else if (key.downArrow) {
      setFocus((f) => Math.min(FIELDS.length - 1, f + 1));
    } else if (key.leftArrow) {
      cycle(-1);
    } else if (key.rightArrow) {
      cycle(1);
    }
  });
  const row = (idx: number, name: string, value: string): ReactElement => (
    <Text color={focus === idx ? 'cyan' : undefined}>
      {focus === idx ? '▸ ' : '  '}
      {name}: {value}
    </Text>
  );
  return (
    <Box flexDirection="column">
      <Text bold>Global defaults</Text>
      {row(0, 'separator', d.separator)}
      {row(1, 'padding', String(d.padding))}
      <Text color="gray"> align: {d.align} (stored, not yet applied)</Text>
      <Text dimColor>↑/↓ field · ←/→ change · esc back</Text>
    </Box>
  );
}
