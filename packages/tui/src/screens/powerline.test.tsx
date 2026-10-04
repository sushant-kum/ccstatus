import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Powerline } from './powerline.js'
import { SEPARATOR_PRESETS } from '../separators.js'
import { defaultConfig } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))
const DOWN = '\u001B[B', RIGHT = '\u001B[C'

test('shows preset names and current separator', () => {
  const { lastFrame, unmount } = render(<Powerline config={defaultConfig} setConfig={()=>{}} goHome={()=>{}}/>)
  const f = lastFrame()!
  for (const p of SEPARATOR_PRESETS) { expect(f).toContain(p.name); expect(f).toContain(p.code) }
  expect(f).toContain('Custom')
  expect(f).toContain(defaultConfig.defaults.separator)
  expect(f).toContain('not applied')
  unmount()
})
test('→ on separator row chooses space', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Powerline config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write(RIGHT); await tick()
  expect(setConfig.mock.calls[0]![0].defaults.separator).toBe('space')
  unmount()
})
test('selecting a preset sets glyph', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Powerline config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write(DOWN); await tick(); stdin.write(DOWN); await tick() // Triangle Left
  stdin.write('\r'); await tick()
  expect(setConfig.mock.calls[0]![0].defaults.glyph).toBe(SEPARATOR_PRESETS[1]!.char)
  unmount()
})
test('custom glyph typed then enter sets glyph and shows code', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Powerline config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  for (let i = 0; i < 7; i++) { stdin.write(DOWN); await tick() }
  stdin.write('\r'); await tick()
  stdin.write('>'); await tick()
  stdin.write('\r'); await tick()
  expect(setConfig.mock.calls[0]![0].defaults.glyph).toBe('>')
  unmount()
})
test('custom glyph displays Custom (U+XXXX)', () => {
  const cfg = { ...defaultConfig, defaults: { ...defaultConfig.defaults, glyph: '>' } }
  const { lastFrame, unmount } = render(<Powerline config={cfg} setConfig={()=>{}} goHome={()=>{}}/>)
  expect(lastFrame()).toContain('Custom (U+003E)')
  unmount()
})
test('toggling invert sets defaults.invert', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Powerline config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  for (let i = 0; i < 8; i++) { stdin.write(DOWN); await tick() }
  stdin.write('\r'); await tick()
  expect(setConfig.mock.calls[0]![0].defaults.invert).toBe(!defaultConfig.defaults.invert)
  unmount()
})
