import { expect, test } from 'vitest'
import { defaultConfig } from './config/defaults.js'
import type { Snapshot } from './snapshot.js'
import { render } from './render.js'

const snap: Snapshot = {
  version: '2.1.0', model: 'Opus', effort: null, cwd: '/x/app', repo: false, gitRoot: '',
  gitBranch: '', gitWorktree: '', added: 0, modified: 0, deleted: 0,
  ctxTokens: 42000, ctxPct: 21, cached: 0, input: 0, output: 0, total: 0, startedAt: 0,
  cost: null, fivePct: null, fiveReset: null, weekPct: null, weekReset: null,
  blockReset: null, terminalWidth: 120, now: 0,
}

test('band renders the default line', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 120 })
  expect(model.lines).toHaveLength(1)
  const text = model.lines[0]!.segments.map(s => s.text).join('')
  expect(text).toContain('v2.1.0')
  expect(text).toContain('Opus')
  expect(text).toContain('Ctx: 42k')
})

test('disabled surface renders nothing', () => {
  const model = render(defaultConfig, snap, { surface: 'statusline', width: 120 })
  expect(model.lines).toEqual([])
})
