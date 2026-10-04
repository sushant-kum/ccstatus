import { test, expect } from 'claude-code/testing'
import type { Snapshot } from './core.js'
import { dueToasts, evalWhen } from './toasts.js'

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  version: '', model: '', effort: null, cwd: '', repo: false, gitRoot: '', gitBranch: '',
  gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 0, ctxPct: 0,
  cached: 0, input: 0, output: 0, total: 0, startedAt: 0, cost: null,
  fivePct: null, fiveReset: null, weekPct: null, weekReset: null, blockReset: null,
  terminalWidth: 0, now: 0, ...over,
})

test('evalWhen compares fields', () => {
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 85 }))).toBe(true)
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 50 }))).toBe(false)
  expect(evalWhen('fivePct>=90', snap({ fivePct: 90 }))).toBe(true)
})
test('evalWhen is false for null field or garbage', () => {
  expect(evalWhen('fivePct>80', snap({ fivePct: null }))).toBe(false)
  expect(evalWhen('nonsense', snap())).toBe(false)
  expect(evalWhen('bogus>5', snap())).toBe(false)
})
test('dueToasts respects once + fired', () => {
  const rules = [{ when: 'ctxPct>80', text: 'ctx high', once: true }]
  const s = snap({ ctxPct: 90 })
  expect(dueToasts(rules, s, {})).toEqual([{ text: 'ctx high', key: 'ctxPct>80' }])
  expect(dueToasts(rules, s, { 'ctxPct>80': true })).toEqual([])
})
test('dueToasts without once fires regardless of fired', () => {
  const rules = [{ when: 'ctxPct>80', text: 'ctx high' }]
  const s = snap({ ctxPct: 90 })
  expect(dueToasts(rules, s, { 'ctxPct>80': true })).toHaveLength(1)
})
