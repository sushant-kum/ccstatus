import { expect, test } from 'claude-code/testing';

import { defaultConfig, render, toAnsi } from './core.js';

test('statusline surface serializes to an ANSI string when enabled', () => {
  const cfg = {
    ...defaultConfig,
    surfaces: {
      ...defaultConfig.surfaces,
      statusline: { enabled: true, lines: defaultConfig.surfaces.band.lines },
    },
  };
  const snap = {
    version: '9.9.9',
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
    terminalWidth: 0,
    now: 0,
  };
  const s = toAnsi(render(cfg, snap, { surface: 'statusline', width: 80 }));
  expect(s).toContain('v9.9.9');
});
