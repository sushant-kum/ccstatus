import { expect, test } from 'vitest'
import { render } from 'ink-testing-library'
import { App } from './app.js'

test('App renders its title', () => {
  const { lastFrame, unmount } = render(<App/>)
  expect(lastFrame()).toContain('ccstatus')
  unmount()
})
