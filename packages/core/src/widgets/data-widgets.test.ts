import { expect, test } from 'vitest';

import type { Item } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

import { registry } from './registry.js';
import './data-widgets.js'; // registers them

const snap: Snapshot = {
  version: '2.1.0',
  model: 'Opus 4.8',
  effort: 'high',
  cwd: '/home/u/app',
  repo: true,
  gitRoot: 'app',
  gitBranch: 'main',
  gitWorktree: '',
  added: 1,
  modified: 2,
  deleted: 0,
  ctxTokens: 42000,
  ctxPct: 21,
  cached: 1000,
  input: 2000,
  output: 500,
  total: 3500,
  startedAt: 0,
  cost: 0.12,
  fivePct: 30,
  fiveReset: null,
  weekPct: 10,
  weekReset: null,
  blockReset: null,
  terminalWidth: 120,
  sessionId: '',
  ctxWindow: 0,
  gitSha: '',
  outputStyle: null,
  now: 65000,
};
const item = (type: Item['type'], extra: Record<string, unknown> = {}): Item =>
  ({ id: 'x', type, ...extra }) as unknown as Item;
const fmt = (type: Item['type'], extra: Record<string, unknown> = {}): string | null => {
  const def = registry[type];
  if (!def) {
    throw new Error(`widget "${type}" not registered`);
  }
  return def.format({ snapshot: snap, item: item(type, extra), commandOutputs: {} });
};

test('model', () => {
  expect(fmt('model')).toBe('Opus 4.8');
});
test('version labeled vs raw', () => {
  expect(fmt('version')).toBe('v2.1.0');
  expect(fmt('version', { rawValue: true })).toBe('2.1.0');
});
test('context-length and percentage', () => {
  expect(fmt('context-length')).toBe('Ctx: 42k');
  expect(fmt('context-percentage')).toBe('Ctx Used: 21%');
});
test('tokens', () => {
  expect(fmt('tokens-input')).toBe('In: 2k');
  expect(fmt('tokens-output')).toBe('Out: 500');
  expect(fmt('tokens-cached')).toBe('Cached: 1k');
  expect(fmt('tokens-total')).toBe('Total: 3.5k');
});
test('session-clock', () => {
  expect(fmt('session-clock')).toBe('Session: 1m 5s');
});
test('cwd basename', () => {
  expect(fmt('cwd')).toBe('app');
});

test('context-bar renders a bar for ctxPct', () => {
  expect(fmt('context-bar')).toBe('█░░░░');
});
test('context-remaining is 100 - ctxPct', () => {
  expect(fmt('context-remaining')).toBe('Ctx Left: 79%');
  expect(fmt('context-remaining', { rawValue: true })).toBe('79%');
});
test('thinking-effort shows effort, null when absent', () => {
  expect(fmt('thinking-effort')).toBe('Effort: high');
  expect(fmt('thinking-effort', { rawValue: true })).toBe('high');
  const def = registry['thinking-effort'];
  expect(
    def?.format({
      snapshot: { ...snap, effort: null },
      item: item('thinking-effort'),
      commandOutputs: {},
    })
  ).toBeNull();
});

const fmtSnap = (
  type: Item['type'],
  over: Partial<Snapshot>,
  extra: Record<string, unknown> = {}
): string | null => {
  const def = registry[type];
  if (!def) {
    throw new Error(`widget "${type}" not registered`);
  }
  return def.format({
    snapshot: { ...snap, ...over },
    item: item(type, extra),
    commandOutputs: {},
  });
};

test('session-id shows first 8 chars, full when raw, null when empty', () => {
  expect(fmtSnap('session-id', { sessionId: 'abcdef1234567' })).toBe('abcdef12');
  expect(fmtSnap('session-id', { sessionId: 'abcdef1234567' }, { rawValue: true })).toBe(
    'abcdef1234567'
  );
  expect(fmtSnap('session-id', { sessionId: '' })).toBeNull();
});
test('context-window shows the window size, null when 0', () => {
  expect(fmtSnap('context-window', { ctxWindow: 200000 })).toBe('Window: 200k');
  expect(fmtSnap('context-window', { ctxWindow: 200000 }, { rawValue: true })).toBe('200k');
  expect(fmtSnap('context-window', { ctxWindow: 0 })).toBeNull();
});
test('output-style shows the style, null when none', () => {
  expect(fmtSnap('output-style', { outputStyle: 'concise' })).toBe('Style: concise');
  expect(fmtSnap('output-style', { outputStyle: null })).toBeNull();
});
test('terminal-width shows width when known', () => {
  expect(fmtSnap('terminal-width', { terminalWidth: 120 })).toBe('Width: 120');
  expect(fmtSnap('terminal-width', { terminalWidth: 0 })).toBeNull();
});
