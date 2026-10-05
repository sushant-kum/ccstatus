import { test, expect, mock } from 'claude-code/testing'
import { render, defaultConfig } from './core.js'

const snap: any = { version: 'v', model: 'M', effort: null, cwd: '', repo: false, gitRoot: '', gitBranch: '', gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 10, ctxPct: 1, cached: 0, input: 0, output: 0, total: 0, startedAt: 0, cost: null, fivePct: null, fiveReset: null, weekPct: null, weekReset: null, blockReset: null, terminalWidth: 0, now: 0 }

test('pane surface renders when enabled', () => {
  const cfg = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    pane: { enabled: true, lines: defaultConfig.surfaces.band.lines } } }
  expect(render(cfg, snap, { surface: 'pane', width: 80 }).lines.length).toBeGreaterThan(0)
})

test('Pane mount with requestId ccstatus paints the pane surface', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME: '/h' })
  const cfg = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    pane: { enabled: true, lines: defaultConfig.surfaces.band.lines } } }
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: { command: 'ccstatus' } }))
  on('ui.render', async ($, e) => ($.ui.resolve(e) as any).Box({}) as any)
  on('fs.read', async () => ({ value: JSON.stringify(cfg) }) as any)
  on('session.cwd', async () => ({ value: '' }))
  on('session.model', async () => ({ value: 'opus' }))
  on('session.version', async () => ({ value: { version: '1.2.3' } }))
  on('session.usage', async () => ({
    value: { context: { tokens: 1234, percent: 12 }, rateLimits: [], startedAt: 0 },
  } as any))
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'ccstatus', surface: 'terminal', component: 'Pane', requestId: 'ccstatus',
    props: { bodyColumns: 100 } as any,
  } as any)
  expect(await ui.find({ type: 'Text', text: 'Ctx' })).toBeDefined()
})
