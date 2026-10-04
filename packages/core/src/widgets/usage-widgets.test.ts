import { expect, test } from 'vitest'
import type { Snapshot } from '../snapshot.js'
import type { Item } from '../config/types.js'
import { registry } from './registry.js'
import './usage-widgets.js'

const now = 1_000_000
const base: Snapshot = {
  version: '', model: '', effort: null, cwd: '', repo: false, gitRoot: '', gitBranch: '',
  gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 0, ctxPct: 0,
  cached: 0, input: 0, output: 0, total: 0, startedAt: 0,
  cost: 0.12, fivePct: 30, fiveReset: new Date(now + 3_720_000).toISOString(),
  weekPct: 10, weekReset: null, blockReset: null, terminalWidth: 80, now,
}
const fmt = (type: Item['type'], snapshot: Snapshot) =>
  registry[type]!.format({ snapshot, item: { id: 'x', type }, commandOutputs: {} })

test('cost', () => {
  expect(fmt('cost', base)).toBe('$0.12')
  expect(fmt('cost', { ...base, cost: null })).toBeNull()
})
test('rate-limit-5h with reset', () => {
  expect(fmt('rate-limit-5h', base)).toBe('Session: █░░░░ 30%  1h 2m')
})
test('rate-limit-5h missing', () => {
  expect(fmt('rate-limit-5h', { ...base, fivePct: null })).toBe('Session: —')
})
test('rate-limit-week without reset', () => {
  expect(fmt('rate-limit-week', base)).toBe('Weekly: 10%')
})
test('block-timer missing', () => {
  expect(fmt('block-timer', base)).toBeNull()
})
