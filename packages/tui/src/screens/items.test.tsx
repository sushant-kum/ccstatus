import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Items } from './items.js'
import { defaultConfig } from '@ccstatus/core'
import type { Config } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))
function Harness({ initial, onChange }: { initial: Config; onChange: (c: Config) => void }){
  const [c, setC] = useState(initial)
  return <Items config={c} setConfig={n => { setC(n); onChange(n) }} goHome={()=>{}}/>
}
const DOWN = '\u001B[B', RIGHT = '\u001B[C'
const len = defaultConfig.surfaces.band.lines[0]!.length

test('lists the band items and can remove one', async () => {
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  expect(lastFrame()).toContain('version')
  expect(lastFrame()).toContain('model')
  stdin.write('x'); await tick()
  const next = setConfig.mock.calls.at(-1)![0]
  expect(next.surfaces.band.lines[0].length).toBe(len - 1)
  expect(defaultConfig.surfaces.band.lines[0]!.length).toBe(len)
  unmount()
})

test('a opens the picker; enter adds a new item', async () => {
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('a'); await tick()
  expect(lastFrame()).toContain('Add widget')
  stdin.write('\u001B[B'); await tick()
  stdin.write('\r'); await tick()
  const next = setConfig.mock.calls.at(-1)![0]
  const line = next.surfaces.band.lines[0]
  expect(line.length).toBe(len + 1)
  expect(line.at(-1).id).toMatch(/^[a-z0-9-]+-[a-z0-9]+$/)
  unmount()
})

test('] reorders the selected item right', async () => {
  const setConfig = vi.fn()
  const { stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write(']'); await tick()
  const ids = (defaultConfig.surfaces.band.lines[0]!).map(i => i.id)
  const got = setConfig.mock.calls.at(-1)![0].surfaces.band.lines[0].map((i: {id:string}) => i.id)
  expect(got).toEqual([ids[1], ids[0], ...ids.slice(2)])
  unmount()
})

test('e edits: ↓ to raw, → toggles rawValue; tab switches surface; esc home', async () => {
  const setConfig = vi.fn(), goHome = vi.fn()
  const { lastFrame, stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={goHome}/>)
  await tick()
  stdin.write('e'); await tick()
  stdin.write('\u001B[B'); await tick()
  stdin.write('\u001B[B'); await tick()
  stdin.write('\u001B[C'); await tick()
  expect(setConfig.mock.calls.at(-1)![0].surfaces.band.lines[0][0].rawValue).toBe(true)
  stdin.write('\u001B'); await tick(); await new Promise(r => setTimeout(r, 50))
  expect(goHome).not.toHaveBeenCalled() // esc leaves editor first
  stdin.write('\t'); await tick()
  expect(lastFrame()).toContain('statusline')
  unmount()
})

test('fg and bg cycle to a color, then back to (none) which removes the key', async () => {
  for (const [downs, key] of [[0, 'fg'], [1, 'bg']] as const) {
    let last!: Config
    const { stdin, unmount } = render(<Harness initial={defaultConfig} onChange={c => { last = c }}/>)
    await tick()
    stdin.write('e'); await tick()
    for (let i = 0; i < downs; i++) { stdin.write(DOWN); await tick() }
    // defaults give item 0 a fg/bg; cycle forward until it wraps to (none)
    let guard = 0
    while ((last?.surfaces.band.lines[0]![0] as Record<string, unknown> | undefined)?.[key] !== undefined || guard === 0) {
      stdin.write(RIGHT); await tick()
      expect(++guard).toBeLessThan(60)
    }
    expect('fg' in last.surfaces.band.lines[0]![0]! && key === 'fg').toBe(false)
    expect(key in last.surfaces.band.lines[0]![0]!).toBe(false)
    stdin.write(RIGHT); await tick()
    expect((last.surfaces.band.lines[0]![0] as Record<string, unknown>)[key]).toBeDefined()
    unmount()
  }
})

test('editing line 0 preserves lines[1]', async () => {
  const extra = { id: 'cwd-x', type: 'cwd' as const }
  const cfg: Config = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    band: { ...defaultConfig.surfaces.band, lines: [defaultConfig.surfaces.band.lines[0]!, [extra]] } } }
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Items config={cfg} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  stdin.write('x'); await tick()
  const next = setConfig.mock.calls.at(-1)![0] as Config
  expect(next.surfaces.band.lines.length).toBe(2)
  expect(next.surfaces.band.lines[1]).toEqual([extra])
  unmount()
})

test('empty line: x, e, → do not throw', async () => {
  const cfg: Config = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    band: { ...defaultConfig.surfaces.band, lines: [[]] } } }
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(<Items config={cfg} setConfig={setConfig} goHome={()=>{}}/>)
  await tick()
  for (const k of ['x', 'e', RIGHT]) { stdin.write(k); await tick() }
  expect(lastFrame()).toContain('no items')
  expect(setConfig).not.toHaveBeenCalled()
  unmount()
})
