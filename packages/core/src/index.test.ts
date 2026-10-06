import { expect, test } from 'vitest';

import * as core from './index.js';
import { defaultConfig } from './index.js';

test('public API is exported', () => {
  for (const name of [
    'render',
    'toAnsi',
    'loadConfig',
    'defaultConfig',
    'importCcstatusline',
    'registry',
    'isColor',
    'COLORS',
  ]) {
    expect(core).toHaveProperty(name);
  }
});

test('end-to-end: default config renders a band to ANSI', () => {
  const model = core.render(
    defaultConfig,
    {
      version: '1.0.0',
      model: 'M',
      effort: null,
      cwd: '/a/b',
      repo: false,
      gitRoot: '',
      gitBranch: '',
      gitWorktree: '',
      added: 0,
      modified: 0,
      deleted: 0,
      ctxTokens: 1000,
      ctxPct: 5,
      cached: 0,
      input: 0,
      output: 0,
      total: 0,
      startedAt: 0,
      cost: null,
      fivePct: null,
      fiveReset: null,
      weekPct: null,
      weekReset: null,
      blockReset: null,
      terminalWidth: 100,
      now: 0,
    },
    { surface: 'band', width: 100 }
  );
  expect(core.toAnsi(model)).toContain('v1.0.0');
});
