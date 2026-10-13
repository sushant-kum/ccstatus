import { defaultConfig } from '@ccstatus/core';
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
  expect(f).toContain('bgCyan');
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
  expect(c.themes.default[0].fg).toBeDefined();
  expect(c.themes.default[0].fg).not.toBe(origFg);
  expect(c.themes.default[0].bg).toBe('bgCyan');
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
  await tick(); // picker, cursor on current bg
  for (let i = 0; i < 40; i++) {
    stdin.write('\u001B[A'); // up to (none), the first option
  }
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const slot = setConfig.mock.calls[0]?.[0].themes.default[0];
  expect(slot.bg).toBeUndefined();
  expect(slot.fg).toBe(defaultConfig.themes.default?.[0]?.fg);
  expect(defaultConfig.themes.default?.[0]?.bg).toBe('bgCyan');
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
  await tick(); // picker, cursor on current fg
  for (let i = 0; i < 40; i++) {
    stdin.write('\u001B[A'); // up to (none), the first option
  }
  await tick();
  await tick();
  stdin.write('\r');
  await tick();
  const slot = setConfig.mock.calls[0]?.[0].themes.default[0];
  expect(slot.fg).toBeUndefined();
  expect(slot.bg).toBe('bgCyan'); // bg kept, so the slot now auto-contrasts
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
