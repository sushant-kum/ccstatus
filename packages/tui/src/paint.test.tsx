import { expect, test, beforeAll } from 'vitest'
import { render } from 'ink-testing-library'
import { paintModel } from './paint.js'
import type { RenderModel } from '@ccstatus/core'

beforeAll(() => { process.env.FORCE_COLOR = '1' })

const model = (seg: object) => ({ lines: [{ segments: [{ text: 'X', kind: 'text', ...seg }] }] }) as unknown as RenderModel

test('bright bg maps to ANSI bright background', async () => {
  const { default: chalk } = await import('chalk')
  chalk.level = 1
  const { lastFrame, unmount } = render(paintModel(model({ bg: 'bgBrightYellow' })))
  expect(lastFrame()).toContain('\u001b[103m')
  unmount()
})

test('bright fg maps to ANSI bright foreground', async () => {
  const { default: chalk } = await import('chalk')
  chalk.level = 1
  const { lastFrame, unmount } = render(paintModel(model({ fg: 'brightBlack' })))
  expect(lastFrame()).toContain('\u001b[90m')
  unmount()
})
