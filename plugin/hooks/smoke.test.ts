import { expect, test } from 'claude-code/testing';

import * as core from './core.js';

test('core bundle is importable and renders', async () => {
  expect(typeof core.render).toBe('function');
  expect(typeof core.loadConfig).toBe('function');
  const { config } = core.loadConfig(undefined);
  expect(config.version).toBe(1);
});
