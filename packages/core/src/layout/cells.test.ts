import { expect, test } from 'vitest'
import type { Config } from '../config/types.js'
import type { Snapshot } from '../snapshot.js'
import { itemToCell, lineToCells } from './cells.js'
import '../widgets/data-widgets.js'
import '../widgets/git-widgets.js'
import '../widgets/custom-widgets.js'

const config = {
  theme: 'default',
  themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
  defaults: { separator: 'powerline', padding: 1, align: 'left' },
} as unknown as Config
const snap = { model: 'Opus', repo: false } as unknown as Snapshot

test('itemToCell pads and colors', () => {
  expect(itemToCell({ id: 'a', type: 'model' }, config, snap, {})).toEqual({
    text: ' Opus ', fg: 'black', bg: 'bgCyan', merge: false, flex: false,
  })
})
test('omitted widget yields null', () => {
  expect(itemToCell({ id: 'g', type: 'git-branch' }, config, snap, {})).toBeNull()
})
test('flex cell is unpadded and flagged', () => {
  expect(itemToCell({ id: 'f', type: 'flex-separator' }, config, snap, {})).toEqual({
    text: '', fg: undefined, bg: undefined, merge: false, flex: true,
  })
})
test('lineToCells drops nulls', () => {
  const cells = lineToCells(
    [{ id: 'a', type: 'model' }, { id: 'g', type: 'git-branch' }],
    config, snap, {},
  )
  expect(cells).toHaveLength(1)
})
