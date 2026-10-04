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
