import { test, expect, mock } from 'claude-code/testing'
import { shouldReload } from './config-io.js'
import { defaultConfig } from './core.js'

test('shouldReload on first stat and on mtime change', () => {
  expect(shouldReload(null, { mtimeMs: 10 })).toBe(true)
  expect(shouldReload(10, { mtimeMs: 10 })).toBe(false)
  expect(shouldReload(10, { mtimeMs: 20 })).toBe(true)
})

function withStatusline(enabled: boolean) {
  return { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    statusline: { enabled, lines: defaultConfig.surfaces.band.lines } } }
}

function setup($: any, on: any) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME: '/h' })
  const w = { text: JSON.stringify(withStatusline(true)), mtime: 1, status: undefined as string | undefined,
    reads: 0, writes: [] as string[], clock: null as any }
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: { command: 'ccstatus' } }))
  on('fs.read', async () => { w.reads++; return { value: w.text } as any })
  on('fs.stat', async () => ({ value: { mtimeMs: w.mtime } }) as any)
  on('fs.write', async (_$: any, e: any) => { w.writes.push(e.text); w.text = e.text; return { value: undefined } as any })
  on('session.cwd', async () => ({ value: '' }))
  on('session.model', async () => ({ value: 'opus' }))
  on('session.version', async () => ({ value: { version: '1.2.3' } }))
  on('session.usage', async () => ({
    value: { context: { tokens: 1, percent: 5 }, rateLimits: [], startedAt: 0 } } as any))
  on('ui.status', async (_$: any, e: any) => { w.status = e.text; return { value: undefined } as any })
  w.clock = clock
  return w
}

test('tick reloads config when the file mtime changes', async ($, on) => {
  const w = setup($, on)
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true })
  expect(w.status).toContain('v1.2.3')
  w.text = JSON.stringify(withStatusline(false))
  await w.clock.advance(2100) // same mtime: no reload
  expect(w.status).toContain('v1.2.3')
  w.mtime = 2
  await w.clock.advance(2100)
  expect(w.status).toBeUndefined()
})

test('/ccstatus reload forces a re-read', async ($, on) => {
  const w = setup($, on)
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true })
  w.text = JSON.stringify(withStatusline(false)) // mtime unchanged
  const r = await $.command.run({ command: 'ccstatus', args: 'reload' } as any)
  expect(r.text).toContain('reload')
  await w.clock.advance(2100)
  expect(w.status).toBeUndefined()
})

test('/ccstatus theme <name> writes the config back', async ($, on) => {
  const w = setup($, on)
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true })
  const name = Object.keys(defaultConfig.themes)[0]!
  const r = await $.command.run({ command: 'ccstatus', args: `theme ${name}` } as any)
  expect(w.writes).toHaveLength(1)
  expect(JSON.parse(w.writes[0]!).theme).toBe(name)
  const bad = await $.command.run({ command: 'ccstatus', args: 'theme nope-x' } as any)
  expect(bad.text).toContain('unknown')
  const edit = await $.command.run({ command: 'ccstatus', args: 'edit' } as any)
  expect(edit.text).toContain('npx ccstatus')
})
