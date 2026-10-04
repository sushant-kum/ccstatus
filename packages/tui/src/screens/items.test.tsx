import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Items } from './items.js'
import { defaultConfig } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))
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
