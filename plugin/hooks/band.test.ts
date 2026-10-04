import { test, expect } from 'claude-code/testing'
import { paintModel } from './paint.js'

test('paintModel builds one row per line with a node per segment', () => {
  const Box = (props: any) => ({ t: 'Box', props, children: props.children })
  const Text = (props: any) => ({ t: 'Text', props, children: props.children })
  const model = { lines: [{ segments: [
    { kind: 'cell', text: ' a ', fg: 'black', bg: 'bgCyan' },
    { kind: 'separator', text: '▒', fg: 'cyan', bg: 'bgBlue' },
    { kind: 'cell', text: ' b ', fg: 'white', bg: 'bgBlue' },
  ] }] }
  const tree: any = paintModel(model as any, { Box, Text })
  expect(tree.t).toBe('Box')
  const line = tree.children[0]
  expect(line.children).toHaveLength(3)
  expect(line.children[0].props.backgroundColor).toBe('bgCyan')
  expect(line.children[1].props.color).toBe('cyan')
})

import { mock } from 'claude-code/testing'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`band renders default config text on ${surface}`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    mock.env(on, { HOME: '/nonexistent-home' })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('command.register', async () => ({ value: { command: 'ccstatus' } }))
    on('ui.render', async ($, e) => ($.ui.resolve(e) as any).Box({}) as any)
    on('fs.read', async () => ({ deny: 'ENOENT' }))
    on('session.cwd', async () => ({ value: '' }))
    on('session.model', async () => ({ value: 'opus' }))
    on('session.version', async () => ({ value: { version: '1.2.3' } }))
    on('session.usage', async () => ({
      value: { context: { tokens: 1234, percent: 12 }, rateLimits: [], startedAt: 0 },
    } as any))
    await $.session.start({ cwd: '', surface, isInteractive: true })
    const ui = await $.ui.mount({
      plugin: 'ccstatus', surface, component: 'AbovePrompt',
      props: { bodyColumns: 120, hasSurvey: false } as any,
    })
    const hit = await ui.find({ type: 'Text', text: 'Ctx' })
    expect(hit).toBeDefined()
  })
}
