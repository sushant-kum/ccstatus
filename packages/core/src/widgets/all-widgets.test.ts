import { expect, test } from 'vitest';

import type { Item } from '../config/types.js';
import { WIDGET_TYPES } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

import { registry } from './registry.js';
import '../render.js'; // side-effect: registers every widget module

const zero: Snapshot = {
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
};

test('every widget type is registered and formats a zeroed snapshot without throwing', () => {
  for (const type of WIDGET_TYPES) {
    const def = registry[type];
    expect(def, `widget "${type}" should be registered`).toBeDefined();
    if (!def) {
      continue;
    }
    const item = { id: 't', type, text: '', command: '' } as unknown as Item;
    expect(
      () => def.format({ snapshot: zero, item, commandOutputs: {} }),
      `widget "${type}" threw`
    ).not.toThrow();
  }
});
