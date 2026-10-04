import { expect, test, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { Import } from './import.js'
import { defaultConfig } from '@ccstatus/core'

const tick = () => new Promise(r => setTimeout(r, 20))
const good = JSON.stringify({ version: 1, lines: [[{ id: 'v', type: 'version' }, { id: 'm', type: 'model' }, { id: 'x', type: 'weird' }]] })

test('shows summary and ⏎ replaces band, preserving the rest', async () => {
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(<Import config={defaultConfig} setConfig={setConfig} goHome={()=>{}} readFile={() => good}/>)
  await tick()
  expect(lastFrame()).toContain('mapped 2 item(s), dropped 1')
  stdin.write('\r'); await tick()
  const next = setConfig.mock.calls[0]![0]
  expect(next.surfaces.band.lines[0].map((i: { type: string }) => i.type)).toEqual(['version', 'model'])
  expect(next.defaults).toEqual(defaultConfig.defaults)
  expect(next.surfaces.toasts).toEqual(defaultConfig.surfaces.toasts)
  unmount()
})
test('bad JSON warns and does not replace', async () => {
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(<Import config={defaultConfig} setConfig={setConfig} goHome={()=>{}} readFile={() => '{nope'}/>)
  await tick()
  expect(lastFrame()).toContain('invalid JSON')
  stdin.write('\r'); await tick()
  expect(setConfig).not.toHaveBeenCalled()
  unmount()
})
test('custom path entry reads the typed path', async () => {
  const reads: string[] = []
  const setConfig = vi.fn()
  const { stdin, unmount } = render(<Import config={defaultConfig} setConfig={setConfig} goHome={()=>{}} readFile={(p) => { reads.push(p); return p === '/a/b.json' ? good : null }}/>)
  await tick()
  stdin.write('\u001B[B'); await tick()
  stdin.write('/a/b.json'); await tick()
  stdin.write('\r'); await tick()
  expect(reads).toContain('/a/b.json')
  expect(setConfig).toHaveBeenCalledTimes(1)
  unmount()
})
test('foreign file (no lines) is not imported', async () => {
  const setConfig = vi.fn()
  const { lastFrame, stdin, unmount } = render(<Import config={defaultConfig} setConfig={setConfig} goHome={()=>{}} readFile={() => '{"a":1}'}/>)
  await tick()
  expect(lastFrame()).toContain('not a ccstatusline config')
  stdin.write('\r'); await tick()
  expect(setConfig).not.toHaveBeenCalled()
  unmount()
})
