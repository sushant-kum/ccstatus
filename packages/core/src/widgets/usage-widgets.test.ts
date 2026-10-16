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
  insertions: 0,
  deletions: 0,
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
  sessionId: '',
  ctxWindow: 0,
  gitSha: '',
  outputStyle: null,
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
test('rate-limit-5h shows 0% when the percentage is unavailable (DEC-0033)', () => {
  // no reading yet: percentage and reset both null -> empty bar, 0%, no reset suffix
  expect(fmt('rate-limit-5h', { ...base, fivePct: null, fiveReset: null })).toBe(
    'Session: ░░░░░ 0%'
  );
});
test('rate-limit-5h renders a genuine 0% with its bar and reset', () => {
  expect(fmt('rate-limit-5h', { ...base, fivePct: 0 })).toBe('Session: ░░░░░ 0%  1h 2m');
});
test('rate-limit-5h shows 0% with the reset suffix when pct is unavailable but reset is known', () => {
  // the new code computes the reset independently of the (coerced) percentage — on main the
  // `fivePct === null` early return skipped the suffix entirely (DEC-0033).
  expect(fmt('rate-limit-5h', { ...base, fivePct: null })).toBe('Session: ░░░░░ 0%  1h 2m');
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
test('rate-limit-week shows 0% when the percentage is unavailable (DEC-0033)', () => {
  const reset = new Date(now + 3_720_000).toISOString();
  expect(fmt('rate-limit-week', { ...base, weekPct: null })).toBe('Weekly: 0%'); // base weekReset null
  // a genuine 0 and an unavailable pct both read 0%; the reset suffix shows whenever its time is known
  expect(fmt('rate-limit-week', { ...base, weekPct: 0, weekReset: reset })).toBe(
    'Weekly: 0%  1h 2m'
  );
  expect(fmt('rate-limit-week', { ...base, weekPct: null, weekReset: reset })).toBe(
    'Weekly: 0%  1h 2m'
  );
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
test('session-usage shows the 5h percentage, or 0% when unknown (DEC-0033)', () => {
  expect(fmt('session-usage', { ...base, fivePct: 42 })).toBe('Session: 42%');
  expect(fmt('session-usage', { ...base, fivePct: 0 })).toBe('Session: 0%');
  expect(fmt('session-usage', { ...base, fivePct: null })).toBe('Session: 0%');
});
test('weekly-usage shows the weekly percentage, or 0% when unknown (DEC-0033)', () => {
  expect(fmt('weekly-usage', { ...base, weekPct: 10 })).toBe('Weekly: 10%');
  expect(fmt('weekly-usage', { ...base, weekPct: 0 })).toBe('Weekly: 0%');
  expect(fmt('weekly-usage', { ...base, weekPct: null })).toBe('Weekly: 0%');
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

test('session-cost-rate: null when cost null or elapsed < 1min, else $/hr', () => {
  expect(fmt('session-cost-rate', { ...base, cost: null, now: 3_600_000 })).toBeNull();
  expect(fmt('session-cost-rate', { ...base, cost: 1, startedAt: 0, now: 30_000 })).toBeNull();
  expect(fmt('session-cost-rate', { ...base, cost: 1, startedAt: 0, now: 3_600_000 })).toBe(
    '$1.00/hr'
  );
});

test('session-cost-rate: 60_000 ms boundary is inclusive', () => {
  expect(fmt('session-cost-rate', { ...base, cost: 1, startedAt: 0, now: 60_000 })).toBe(
    '$60.00/hr'
  );
  expect(fmt('session-cost-rate', { ...base, cost: 1, startedAt: 0, now: 59_999 })).toBeNull();
});

test('session-cost-rate: zero cost renders $0.00/hr, not null', () => {
  expect(fmt('session-cost-rate', { ...base, cost: 0, startedAt: 0, now: 120_000 })).toBe(
    '$0.00/hr'
  );
});
