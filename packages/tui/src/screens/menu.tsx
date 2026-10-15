import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { LOGO_ART, type LogoCell } from '../logo-art.js';
import { VERSION } from '../version.js';

const ITEMS = [
  ['items', 'Edit items'],
  ['themes', 'Themes'],
  ['powerline', 'Powerline & separators'],
  ['surfaces', 'Surfaces'],
  ['statusline', 'Native status line'],
  ['defaults', 'Global defaults'],
  ['preview', 'Preview'],
  ['import', 'Import from ccstatusline'],
  ['save', 'Save & quit'],
  ['quit', 'Quit without saving'],
] as const;

/**
 * Whether the terminal advertises 24-bit colour, so the half-block logo renders faithfully.
 * @returns True when `COLORTERM` indicates truecolor.
 */
function isTrueColor(): boolean {
  const ct = process.env.COLORTERM;
  return ct === 'truecolor' || ct === '24bit';
}

/**
 * Renders one half-block logo cell, picking a glyph that respects transparent halves.
 * @param root0      - The cell props.
 * @param root0.cell - The `[top, bottom]` colours (null = transparent).
 * @returns          The cell element.
 */
function Cell({ cell }: { cell: LogoCell }): ReactElement {
  const [top, bottom] = cell;
  if (top && bottom) {
    return (
      <Text color={top} backgroundColor={bottom}>
        ▀
      </Text>
    );
  }
  if (top) {
    return <Text color={top}>▀</Text>;
  }
  if (bottom) {
    return <Text color={bottom}>▄</Text>;
  }
  return <Text> </Text>;
}

/**
 * Renders the ccstatus logo as a grid of half-block cells, or a `◀◀` glyph on limited terminals.
 * @returns The logo element.
 */
function Logo(): ReactElement {
  if (!isTrueColor()) {
    return <Text color="#c15f3c">◀◀</Text>;
  }
  return (
    <Box flexDirection="column">
      {LOGO_ART.map((row, r) => (
        <Box key={r}>
          {row.map((cell, c) => (
            <Cell key={c} cell={cell} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Renders the top-level configurator menu with keyboard navigation.
 * @param root0          - The menu props.
 * @param root0.onSelect - Callback invoked with the selected menu id.
 * @returns              The menu element.
 */
export function Menu({ onSelect }: { onSelect: (id: string) => void }): ReactElement {
  const [i, setI] = useState(0);
  useInput((_input, key) => {
    if (key.upArrow) {
      setI((v) => Math.max(0, v - 1));
    } else if (key.downArrow) {
      setI((v) => Math.min(ITEMS.length - 1, v + 1));
    } else if (key.return) {
      const entry = ITEMS[i];
      if (entry) {
        onSelect(entry[0]);
      }
    }
  });
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Logo />
        <Box flexDirection="column" marginLeft={2}>
          <Text>
            <Text bold>ccstatus</Text>
            <Text dimColor> v{VERSION}</Text>
          </Text>
          <Text dimColor>configurator</Text>
        </Box>
      </Box>
      {ITEMS.map(([id, label], idx) => (
        <Text key={id} color={idx === i ? 'cyan' : undefined}>
          {idx === i ? '▸ ' : '  '}
          {label}
        </Text>
      ))}
    </Box>
  );
}
