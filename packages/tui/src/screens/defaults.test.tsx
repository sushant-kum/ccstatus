import { defaultConfig } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { expect, test, vi } from 'vitest';

import { Defaults } from './defaults.js';

const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 20));

test('Defaults shows separator/padding, align columns, and the align note when off', () => {
  const { lastFrame, unmount } = render(
    <Defaults
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
  expect(f).toContain('separator');
  expect(f).toContain('powerline');
  expect(f).toContain('align columns');
  expect(f).toContain('off');
  expect(f).toContain('applies when align columns is on'); // align is inert until columns align
  unmount();
});

test('→ on align columns toggles it on via setConfig', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Defaults
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('\u001B[B'); // -> padding
  stdin.write('\u001B[B'); // -> align columns
  await tick();
  stdin.write('\u001B[C'); // toggle on
  await tick();
  expect(setConfig.mock.calls.at(-1)?.[0].defaults.alignColumns).toBe(true);
  expect(defaultConfig.defaults.alignColumns).toBe(false); // prop not mutated
  unmount();
});
test('← / → changes focused padding via setConfig without mutating', async () => {
  const setConfig = vi.fn();
  const before = defaultConfig.defaults.padding;
  const { stdin, unmount } = render(
    <Defaults
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('\u001B[B');
  await tick(); // focus padding
  await tick();
  stdin.write('\u001B[C');
  await tick();
  expect(setConfig).toHaveBeenCalledTimes(1);
  expect(setConfig.mock.calls[0]?.[0].defaults.padding).toBe(before + 1);
  expect(defaultConfig.defaults.padding).toBe(before);
  stdin.write('\u001B[D');
  await tick();
  expect(setConfig.mock.calls[1]?.[0].defaults.padding).toBe(before - 1);
  unmount();
});
test('→ on separator cycles it; esc goes home', async () => {
  const setConfig = vi.fn(),
    goHome = vi.fn();
  const { stdin, unmount } = render(
    <Defaults config={defaultConfig} setConfig={setConfig} goHome={goHome} />
  );
  await tick();
  stdin.write('\u001B[C');
  await tick();
  expect(setConfig.mock.calls[0]?.[0].defaults.separator).toBe('space');
  stdin.write('\u001B');
  await tick();
  await new Promise((r) => setTimeout(r, 50));
  expect(goHome).toHaveBeenCalled();
  unmount();
});
