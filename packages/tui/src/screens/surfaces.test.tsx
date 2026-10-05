import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Surfaces } from './surfaces.js'
import { defaultConfig } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))

test('lists 4 surfaces with checkboxes and existing toast rule', () => {
  const { lastFrame, unmount } = render(<Surfaces config={defaultConfig} setConfig={()=>{}} goHome={()=>{}}/>)
  const f = lastFrame()!
  for (const n of ['band', 'statusline', 'pane', 'toasts']) expect(f).toContain(n)
  expect(f).toMatch(/\[[x ]\] band/)
  expect(f).toContain('ctxPct>80')
  unmount()
})
test('space on statusline toggles enabled immutably', async () => {
  const setConfig = vi.fn()
  const before = defaultConfig.surfaces.statusline.enabled
  const { stdin, unmount } = render(<Surfaces config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('\u001B[B'); await tick()
  stdin.write(' '); await tick()
  expect(setConfig.mock.calls[0]![0].surfaces.statusline.enabled).toBe(!before)
  expect(defaultConfig.surfaces.statusline.enabled).toBe(before)
  unmount()
})
test('adding a preset rule appends to toast rules', async () => {
  const setConfig = vi.fn()
  const n = defaultConfig.surfaces.toasts.rules.length
  const { stdin, unmount } = render(<Surfaces config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('a'); await tick()
  stdin.write('\u001B[B'); await tick()
  stdin.write('\r'); await tick()
  const rules = setConfig.mock.calls[0]![0].surfaces.toasts.rules
  expect(rules.length).toBe(n + 1)
  expect(rules[n].when).toBe('ctxPct>95')
  expect(defaultConfig.surfaces.toasts.rules.length).toBe(n)
  unmount()
})
test('invalid when is marked, not crashing', () => {
  const cfg = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces, toasts: { ...defaultConfig.surfaces.toasts, rules: [{ when: 'bogus!', text: 'x' }] } } }
  const { lastFrame, unmount } = render(<Surfaces config={cfg} setConfig={()=>{}} goHome={()=>{}}/>)
  expect(lastFrame()).toContain('invalid')
  unmount()
})
