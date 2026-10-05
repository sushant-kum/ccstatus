import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Themes } from './themes.js'
import { defaultConfig } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))

test('lists themes with default active and shows its widget colors', () => {
  const { lastFrame, unmount } = render(<Themes config={defaultConfig} setConfig={()=>{}} goHome={()=>{}}/>)
  const f = lastFrame()!
  expect(f).toContain('default (active)')
  expect(f).toContain('nord')
  expect(f).toContain('bgCyan')
  unmount()
})
test('enter on another theme activates it', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Themes config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('\u001B[B'); await tick(); await tick()
  stdin.write('\r'); await tick()
  const next = Object.keys(defaultConfig.themes)[1]!
  expect(setConfig.mock.calls[0]![0].theme).toBe(next)
  expect(defaultConfig.theme).toBe('default')
  unmount()
})
test('picker edits a widget fg within the theme, immutably', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Themes config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('\u001B[C'); await tick(); await tick() // into colors
  stdin.write('\r'); await tick(); await tick()        // picker
  stdin.write('\u001B[B'); await tick(); await tick()
  stdin.write('\r'); await tick()
  const c = setConfig.mock.calls[0]![0]
  expect(c.themes.default.model.fg).not.toBe('black')
  expect(c.themes.default.model.bg).toBe('bgCyan')
  expect(defaultConfig.themes.default!.model!.fg).toBe('black')
  unmount()
})
test('d duplicates the selected theme', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Themes config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick(); stdin.write('d'); await tick()
  expect(setConfig.mock.calls[0]![0].themes['default-copy']).toEqual(defaultConfig.themes.default)
  unmount()
})
