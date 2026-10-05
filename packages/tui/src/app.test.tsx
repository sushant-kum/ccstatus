import { expect, test } from 'vitest'
import { render } from 'ink-testing-library'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { App } from './app.js'
import type { ModStatus, InstallResult } from './mod-status.js'
test('App shows the menu and the pinned preview', () => {
  const { lastFrame, unmount } = render(<App/>)
  const f = lastFrame()!
  expect(f).toContain('Edit items')
  expect(f).toContain('live preview')
  unmount()
})

const tick = () => new Promise(r => setTimeout(r, 30))
test.each(['items','themes','powerline','surfaces','defaults','preview','import'].map((id, i) => [id, i] as const))(
  'menu entry %s routes to a screen and keeps the pinned preview', async (_id, idx) => {
    const { stdin, lastFrame, unmount } = render(<App/>)
    await tick()
    for (let k = 0; k < idx; k++) { stdin.write('\u001B[B'); await tick() }
    stdin.write('\r'); await tick()
    const f = lastFrame()!
    expect(f).toContain('live preview')
    expect(f).not.toContain('coming soon')
    expect(f).not.toContain('Edit items\n')
    unmount()
  })
test('an invalid existing config surfaces a startup warning', async () => {
  const d = mkdtempSync(join(tmpdir(),'ccs-'))
  mkdirSync(join(d,'.config','ccstatus'), { recursive: true })
  writeFileSync(join(d,'.config','ccstatus','config.json'), '{not json')
  const prevHome = process.env.HOME
  const prevXdg = process.env.XDG_CONFIG_HOME
  process.env.HOME = d
  delete process.env.XDG_CONFIG_HOME
  try {
    const { lastFrame, unmount } = render(<App/>)
    await tick()
    expect(lastFrame()).toContain('not valid JSON')
    unmount()
  } finally {
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prevXdg
  }
})
test('a failed save is surfaced and does not exit', async () => {
  const prevHome = process.env.HOME
  const prevXdg = process.env.XDG_CONFIG_HOME
  process.env.HOME = '/dev/null' // dir creation under a non-directory fails (ENOTDIR)
  delete process.env.XDG_CONFIG_HOME
  try {
    const { stdin, lastFrame, unmount } = render(<App/>)
    await tick()
    for (let k = 0; k < 7; k++) { stdin.write('\u001B[B'); await tick() } // → "Save & quit"
    stdin.write('\r'); await tick()
    expect(lastFrame()).toContain('Could not save')
    unmount()
  } finally {
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prevXdg
  }
})
test('preview screen shows w/s controls and cycles them', async () => {
  const { stdin, lastFrame, unmount } = render(<App/>)
  await tick()
  for (let k = 0; k < 5; k++) { stdin.write('\u001B[B'); await tick() }
  stdin.write('\r'); await tick()
  expect(lastFrame()).toContain('w width')
  expect(lastFrame()).toContain('s surface')
  stdin.write('s'); await tick()
  expect(lastFrame()).toContain('statusline')
  stdin.write('w'); await tick()
  expect(lastFrame()).toContain('120')
  unmount()
})

const probe = (status: ModStatus, install?: () => Promise<InstallResult>) => ({
  detect: async () => status,
  install: install ?? (async () => ({ ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' })),
})

test('shows an install banner when the mod is absent', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('absent')}/>)
  await tick()
  expect(lastFrame()).toContain('mod not installed')
  expect(lastFrame()).toContain('press i')
  unmount()
})
test('shows no mod banner when the mod is installed', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('installed')}/>)
  await tick()
  expect(lastFrame()).not.toContain('mod not installed')
  unmount()
})
test('unknown status shows manual instructions and no press-i action', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('unknown')}/>)
  await tick()
  expect(lastFrame()).toContain("couldn't check")
  expect(lastFrame()).not.toContain('press i')
  unmount()
})
test('pressing i on the menu installs the mod and shows the reload message', async () => {
  let called = 0
  const { stdin, lastFrame, unmount } = render(
    <App modProbe={probe('absent', async () => { called++; return { ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' } })}/>)
  await tick()
  stdin.write('i'); await tick(); await tick()
  expect(called).toBe(1)
  expect(lastFrame()).toMatch(/restart Claude Code|reload/i)
  unmount()
})
