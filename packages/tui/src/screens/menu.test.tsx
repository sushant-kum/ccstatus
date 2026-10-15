import { render } from 'ink-testing-library';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { VERSION } from '../version.js';

import { Menu } from './menu.js';

const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 20));

const orig = process.env.COLORTERM;
beforeEach(() => {
  process.env.COLORTERM = 'truecolor';
});
afterEach(() => {
  if (orig === undefined) {
    delete process.env.COLORTERM;
  } else {
    process.env.COLORTERM = orig;
  }
});

test('menu shows the wordmark, version, and the half-block logo', () => {
  const { lastFrame, unmount } = render(<Menu onSelect={() => undefined} />);
  const f = lastFrame() ?? '';
  expect(f).toContain('ccstatus');
  expect(f).toContain(`v${VERSION}`);
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/); // injected real version, not "undefined"
  expect(f).toContain('▀'); // the truecolor half-block logo rendered
  expect(f).toContain('Edit items'); // menu items still present
  unmount();
});

test('menu falls back to the ◀◀ glyph on a non-truecolor terminal', () => {
  delete process.env.COLORTERM;
  const { lastFrame, unmount } = render(<Menu onSelect={() => undefined} />);
  const f = lastFrame() ?? '';
  expect(f).toContain('◀◀');
  expect(f).not.toContain('▀'); // no half-block art without truecolor
  expect(f).toContain(`v${VERSION}`);
  unmount();
});

test('enter selects the focused item', async () => {
  const onSelect = vi.fn();
  const { stdin, unmount } = render(<Menu onSelect={onSelect} />);
  await tick();
  stdin.write('\r');
  await tick();
  expect(onSelect).toHaveBeenCalledWith('items'); // first item focused by default
  unmount();
});
