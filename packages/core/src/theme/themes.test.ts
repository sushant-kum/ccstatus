import { expect, test } from 'vitest'
import type { Config, Item } from '../config/types.js'
import { resolveColors } from './themes.js'

const config = {
  theme: 'default',
  themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
} as unknown as Config

test('theme default applies', () => {
  expect(resolveColors({ id: 'a', type: 'model' }, config)).toEqual({ fg: 'black', bg: 'bgCyan' })
})
test('item override wins', () => {
  expect(resolveColors({ id: 'a', type: 'model', fg: 'white' }, config)).toEqual({ fg: 'white', bg: 'bgCyan' })
})
test('no theme entry yields undefined', () => {
  expect(resolveColors({ id: 'a', type: 'version' }, config)).toEqual({ fg: undefined, bg: undefined })
})
test('missing theme name is safe', () => {
  const c = { ...config, theme: 'nope' } as Config
  expect(resolveColors({ id: 'a', type: 'model' }, c)).toEqual({ fg: undefined, bg: undefined })
})
