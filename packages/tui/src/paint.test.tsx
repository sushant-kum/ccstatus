import type { RenderModel } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { beforeAll, expect, test } from 'vitest';

import { paintModel } from './paint.js';

beforeAll(() => {
  process.env.FORCE_COLOR = '1';
});

const model = (seg: object): RenderModel =>
  ({ lines: [{ segments: [{ text: 'X', kind: 'text', ...seg }] }] }) as unknown as RenderModel;

test('numeric bg paints as a hex truecolor background', async () => {
  const { default: chalk } = await import('chalk');
  chalk.level = 3;
  const { lastFrame, unmount } = render(paintModel(model({ bg: 226 })));
  expect(lastFrame()).toContain('\u001b[48;2;255;255;0m');
  unmount();
});

test('numeric fg paints as a hex truecolor foreground', async () => {
  const { default: chalk } = await import('chalk');
  chalk.level = 3;
  const { lastFrame, unmount } = render(paintModel(model({ fg: 196 })));
  expect(lastFrame()).toContain('\u001b[38;2;255;0;0m');
  unmount();
});
