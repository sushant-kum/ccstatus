import { expect, test } from 'vitest';

import type { Snapshot } from './snapshot.js';
import { evalWhen, isValidWhen } from './toast.js';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  version: '',
  model: '',
  effort: null,
  cwd: '',
  repo: false,
  gitRoot: '',
  gitBranch: '',
  gitWorktree: '',
  added: 0,
  modified: 0,
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
  terminalWidth: 0,
  now: 0,
  ...over,
});

test('isValidWhen accepts known fields and rejects unknown/garbage', () => {
  expect(isValidWhen('ctxPct>80')).toBe(true);
  expect(isValidWhen('cost<=1.5')).toBe(true);
  expect(isValidWhen('bogus>5')).toBe(false);
  expect(isValidWhen('nonsense')).toBe(false);
});

test('evalWhen compares the named snapshot field', () => {
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 85 }))).toBe(true);
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 50 }))).toBe(false);
  expect(evalWhen('fivePct>=90', snap({ fivePct: null }))).toBe(false);
  expect(evalWhen('bogus>5', snap())).toBe(false);
});
