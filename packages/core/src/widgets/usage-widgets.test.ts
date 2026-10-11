import { expect, test } from 'vitest';

import type { Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

import { registry } from './registry.js';
import { until } from './usage-widgets.js';

const now = 1_000_000;
const base: Snapshot = {
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
  cost: 0.12,
  fivePct: 30,
  fiveReset: new Date(now + 3_720_000).toISOString(),
  weekPct: 10,
  weekReset: null,
  blockReset: null,
  terminalWidth: 80,
  now,
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

test('cost', () => {
  expect(fmt('cost', base)).toBe('$0.12');
  expect(fmt('cost', { ...base, cost: null })).toBeNull();
});
test('rate-limit-5h with reset', () => {
  expect(fmt('rate-limit-5h', base)).toBe('Session: █░░░░ 30%  1h 2m');
});
test('rate-limit-5h missing', () => {
  expect(fmt('rate-limit-5h', { ...base, fivePct: null })).toBe('Session: —');
});
test('rate-limit-week without reset', () => {
  expect(fmt('rate-limit-week', base)).toBe('Weekly: 10%');
});
test('block-timer missing', () => {
  expect(fmt('block-timer', base)).toBeNull();
});
test('rate-limit-5h with past reset', () => {
  expect(fmt('rate-limit-5h', { ...base, fiveReset: new Date(now - 1000).toISOString() })).toBe(
    'Session: █░░░░ 30%'
  );
});
test('rate-limit-5h with invalid reset', () => {
  expect(fmt('rate-limit-5h', { ...base, fiveReset: 'garbage' })).toBe('Session: █░░░░ 30%');
});
test('rate-limit-week null pct', () => {
  expect(fmt('rate-limit-week', { ...base, weekPct: null })).toBe('Weekly: —');
});
test('block-timer positive', () => {
  expect(fmt('block-timer', { ...base, blockReset: new Date(now + 3_720_000).toISOString() })).toBe(
    'Block: 1h 2m'
  );
});
test('block-timer past', () => {
  expect(
    fmt('block-timer', { ...base, blockReset: new Date(now - 1000).toISOString() })
  ).toBeNull();
});
test('session-usage shows the 5h percentage, or null when unknown', () => {
  expect(fmt('session-usage', { ...base, fivePct: 42 })).toBe('Session: 42%');
  expect(fmt('session-usage', { ...base, fivePct: null })).toBeNull();
});
test('weekly-usage shows the weekly percentage, or null when unknown', () => {
  expect(fmt('weekly-usage', { ...base, weekPct: 10 })).toBe('Weekly: 10%');
  expect(fmt('weekly-usage', { ...base, weekPct: null })).toBeNull();
});
test('reset-timer shows the 5h countdown, null when absent or past', () => {
  expect(fmt('reset-timer', base)).toBe('Reset: 1h 2m');
  expect(fmt('reset-timer', { ...base, fiveReset: null })).toBeNull();
  expect(fmt('reset-timer', { ...base, fiveReset: new Date(now - 1000).toISOString() })).toBeNull();
});
test('weekly-reset-timer shows the weekly countdown, null when absent or past', () => {
  expect(
    fmt('weekly-reset-timer', { ...base, weekReset: new Date(now + 3_720_000).toISOString() })
  ).toBe('Weekly Reset: 1h 2m');
  expect(fmt('weekly-reset-timer', base)).toBeNull();
  expect(
    fmt('weekly-reset-timer', { ...base, weekReset: new Date(now - 1000).toISOString() })
  ).toBeNull();
});
test('until returns remaining ms, or null when unknown, invalid, or past', () => {
  expect(until(new Date(now + 5000).toISOString(), now)).toBe(5000);
  expect(until(null, now)).toBeNull();
  expect(until('garbage', now)).toBeNull();
  expect(until(new Date(now - 1).toISOString(), now)).toBeNull();
});
