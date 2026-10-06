import { expect, test } from 'vitest';

import type { Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

import { registry } from './registry.js';
import './git-widgets.js';

const base: Snapshot = {
  version: '',
  model: '',
  effort: null,
  cwd: '',
  repo: true,
  gitRoot: 'app',
  gitBranch: 'main',
  gitWorktree: 'wt',
  added: 1,
  modified: 2,
  deleted: 0,
  ctxTokens: 0,
  ctxPct: 0,
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
  terminalWidth: 80,
  now: 0,
};
const fmt = (type: Item['type'], snapshot: Snapshot): string | null => {
  const def = registry[type];
  if (!def) {
    throw new Error(`widget "${type}" not registered`);
  }
  return def.format({
    snapshot,
    item: { id: 'x', type } as unknown as Item,
    commandOutputs: {},
  });
};

test('git widgets render when in a repo', () => {
  expect(fmt('git-branch', base)).toBe('✎ main');
  expect(fmt('git-changes', base)).toBe('(+1 ~2 -0)');
  expect(fmt('git-root-dir', base)).toBe('⌂ app');
  expect(fmt('git-worktree', base)).toBe('⎇ wt');
});

test('git widgets omit when not in a repo', () => {
  const noRepo = { ...base, repo: false };
  for (const t of ['git-branch', 'git-changes', 'git-root-dir', 'git-worktree'] as const) {
    expect(fmt(t, noRepo)).toBeNull();
  }
});

test('worktree omits when empty', () => {
  expect(fmt('git-worktree', { ...base, gitWorktree: '' })).toBeNull();
});
