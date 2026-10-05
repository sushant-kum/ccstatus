import { expect, test } from 'vitest'
import type { Snapshot } from './snapshot.js'
import { defaultConfig, render } from './index.js'

const snap: Snapshot = {
  version: '1.0.0', model: 'Opus', effort: null, cwd: '/x', repo: false, gitRoot: '',
  gitBranch: '', gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 0, ctxPct: 0,
  cached: 0, input: 0, output: 0, total: 0, startedAt: 0, cost: null,
  fivePct: null, fiveReset: null, weekPct: null, weekReset: null, blockReset: null,
  terminalWidth: 80, now: 0,
}

test('render returns a RenderModel for the default config', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 80 })
  expect(Array.isArray(model.lines)).toBe(true)
  expect(model.lines.length).toBeGreaterThan(0)
})
