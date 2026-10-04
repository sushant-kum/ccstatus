import { expect, test } from 'vitest'
import { render } from 'ink-testing-library'
import { App } from './app.js'
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
