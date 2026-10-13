import { defaultConfig, indexToHex } from '@ccstatus/core';
import type { Config } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { expect, test, vi } from 'vitest';

import { Themes } from './themes.js';

const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 20));

test('lists themes with default active and shows its slot colors', () => {
  const { lastFrame, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={() => {
        /* no-op */
      }}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  const f = lastFrame() ?? '';
  expect(f).toContain('default (active)');
  expect(f).toContain('nord');
  expect(f).toContain('idx 44');
  unmount();
});
test('enter on another theme activates it', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('\u001B[B');
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const next = Object.keys(defaultConfig.themes)[1] ?? '';
  expect(setConfig.mock.calls[0]?.[0].theme).toBe(next);
  expect(defaultConfig.theme).toBe('default');
  unmount();
});
test('picker edits a slot fg within the theme, immutably', async () => {
  const origFg = defaultConfig.themes.default?.[0]?.fg;
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('\u001B[C');
  await tick();
  await tick(); // into slots
  stdin.write('\r');
  await tick();
  await tick(); // picker
  stdin.write('\u001B[B');
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const c = setConfig.mock.calls[0]?.[0];
  expect(c.themes.default[0].fg).toBe(22); // one row down from idx 16 in the first cube block
  expect(c.themes.default[0].bg).toBe(44);
  expect(defaultConfig.themes.default?.[0]?.fg).toBe(origFg);
  expect(c.themes.default).not.toBe(defaultConfig.themes.default);
  unmount();
});
test('d duplicates the selected theme', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('d');
  await tick();
  expect(setConfig.mock.calls[0]?.[0].themes['default-copy']).toEqual(defaultConfig.themes.default);
  unmount();
});

const RIGHT = '\u001B[C';

/**
 * Drives the themes screen with real state so multi-step flows see their own updates.
 * @param root0          - The harness props.
 * @param root0.onConfig - Called with each config the screen produces.
 * @returns              The stateful themes screen element.
 */
function Stateful({ onConfig }: { onConfig: (c: Config) => void }): ReactElement {
  const [config, setConfig] = useState<Config>(defaultConfig);
  return (
    <Themes
      config={config}
      setConfig={(c) => {
        onConfig(c);
        setConfig(c);
      }}
      goHome={() => {
        /* no-op */
      }}
    />
  );
}

test('a appends a slot and x removes the selected slot', async () => {
  const configs: Config[] = [];
  const base = defaultConfig.themes.default?.length ?? 0;
  const { stdin, unmount } = render(<Stateful onConfig={(c) => configs.push(c)} />);
  await tick();
  stdin.write(RIGHT);
  await tick();
  await tick(); // into slots
  stdin.write('a');
  await tick();
  await tick();
  expect(configs.at(-1)?.themes.default).toHaveLength(base + 1);
  expect(defaultConfig.themes.default).toHaveLength(base);
  stdin.write('x');
  await tick();
  await tick();
  expect(configs.at(-1)?.themes.default).toHaveLength(base);
  unmount();
});

test('the bg picker (none) option clears a slot bg', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write(RIGHT);
  await tick();
  await tick(); // slots
  stdin.write(RIGHT);
  await tick();
  await tick(); // bg field
  stdin.write('\r');
  await tick();
  await tick(); // picker, cursor on current bg (idx 44)
  for (let i = 0; i < 8; i++) {
    stdin.write('\u001B[B'); // down to the (none) row
  }
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const slot = setConfig.mock.calls[0]?.[0].themes.default[0];
  expect(slot.bg).toBeUndefined();
  expect(slot.fg).toBe(defaultConfig.themes.default?.[0]?.fg);
  expect(defaultConfig.themes.default?.[0]?.bg).toBe(44);
  unmount();
});

test('the fg picker (none) option clears a slot fg (enabling auto-contrast)', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write(RIGHT);
  await tick();
  await tick(); // into slots, fg field is selected by default
  stdin.write('\r');
  await tick();
  await tick(); // picker, cursor on current fg (idx 16)
  for (let i = 0; i < 8; i++) {
    stdin.write('\u001B[B'); // down to the (none) row
  }
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const slot = setConfig.mock.calls[0]?.[0].themes.default[0];
  expect(slot.fg).toBeUndefined();
  expect(slot.bg).toBe(44); // bg kept, so the slot now auto-contrasts
  expect(defaultConfig.themes.default?.[0]?.fg).toBeDefined(); // prop not mutated
  unmount();
});

test('a new empty theme shows the empty palette and right-arrow does not enter slots', async () => {
  const { stdin, lastFrame, unmount } = render(<Stateful onConfig={() => undefined} />);
  await tick();
  stdin.write('n');
  await tick();
  await tick();
  expect(lastFrame()).toContain('custom palette slots:');
  expect(lastFrame()).toContain('(empty palette)');
  stdin.write(RIGHT);
  await tick();
  await tick();
  expect(lastFrame()).toContain('(empty palette)');
  expect(lastFrame()).toContain('n new');
  unmount();
});

const DOWN = '\u001B[B';

/**
 * Opens the picker for a slot field, applies key presses, picks, and returns the resulting slot.
 * @param field - Which field to edit.
 * @param keys  - Navigation keys to send inside the picker before confirming.
 * @returns     The edited slot 0 and the config that was produced.
 */
async function pickWith(
  field: 'fg' | 'bg',
  keys: string[]
): Promise<{ slot: { fg?: number; bg?: number }; config: Config }> {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Themes
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write(RIGHT);
  await tick();
  await tick(); // slots
  if (field === 'bg') {
    stdin.write(RIGHT);
    await tick();
    await tick();
  }
  stdin.write('\r');
  await tick();
  await tick(); // picker
  for (const k of keys) {
    stdin.write(k);
    await tick();
  }
  await tick();
  stdin.write('\r');
  await tick();
  unmount();
  const config = setConfig.mock.calls[0]?.[0] as Config;
  return { slot: config.themes.default?.[0] ?? {}, config };
}

test('picking a cube index (across block boundaries) sets a numeric fg', async () => {
  // fg starts on idx 16 (row 0, col 0); 2 rows down + 33 right = block 5, row 2, col 3.
  const keys = [DOWN, DOWN, ...Array.from({ length: 33 }, () => RIGHT)];
  const { slot, config } = await pickWith('fg', keys);
  expect(slot.fg).toBe(16 + 36 * 5 + 6 * 2 + 3);
  expect(slot.fg).toBeGreaterThanOrEqual(16);
  expect(slot.fg).toBeLessThanOrEqual(255);
  expect(indexToHex(slot.fg ?? 0)).toMatch(/^#[0-9a-f]{6}$/);
  expect(config.themes.default).not.toBe(defaultConfig.themes.default);
  expect(defaultConfig.themes.default?.[0]?.fg).toBe(16);
});

test('picking a cube index sets a numeric bg', async () => {
  // bg starts on idx 44 (block 0, row 4, col 2 -> col 2 in block 0); move one right.
  const { slot } = await pickWith('bg', [RIGHT]);
  expect(slot.bg).toBe(45);
  expect(slot.fg).toBe(16);
});

test('the grayscale ramp is reachable and its last swatch is idx 255', async () => {
  // fg starts at row 0; 6 downs reach the ramp row, then 30 rights clamp to its last swatch.
  const keys = [
    ...Array.from({ length: 6 }, () => DOWN),
    ...Array.from({ length: 30 }, () => RIGHT),
  ];
  const { slot } = await pickWith('fg', keys);
  expect(slot.fg).toBe(255);
});

test('the first ramp swatch is idx 232 and the last cube swatch is idx 231', async () => {
  const down6 = Array.from({ length: 6 }, () => DOWN);
  expect((await pickWith('fg', down6)).slot.fg).toBe(232);
  const toLastCube = [
    ...Array.from({ length: 5 }, () => DOWN),
    ...Array.from({ length: 40 }, () => RIGHT),
  ];
  expect((await pickWith('fg', toLastCube)).slot.fg).toBe(231);
});
