import { expect, test } from 'vitest'
import type { Snapshot } from '../snapshot.js'
import type { Item } from '../config/types.js'
import { registry } from './registry.js'
import './custom-widgets.js'

const snap = { terminalWidth: 80, now: 0 } as unknown as Snapshot
const ctx = (item: Item, commandOutputs: Record<string, string> = {}) => ({ snapshot: snap, item, commandOutputs })

test('custom-text', () => {
  expect(registry['custom-text']!.format(ctx({ id: 'a', type: 'custom-text', metadata: { text: 'hi' } }))).toBe('hi')
  expect(registry['custom-text']!.format(ctx({ id: 'a', type: 'custom-text' }))).toBeNull()
})
test('custom-command reads host output', () => {
  const item: Item = { id: 'cc', type: 'custom-command', metadata: { command: 'whoami' } }
  expect(registry['custom-command']!.format(ctx(item, { cc: 'sushant\n' }))).toBe('sushant')
  expect(registry['custom-command']!.format(ctx(item, {}))).toBeNull()
})
test('flex-separator is empty string', () => {
  expect(registry['flex-separator']!.format(ctx({ id: 'f', type: 'flex-separator' }))).toBe('')
})
