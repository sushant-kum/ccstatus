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

import { builtinThemes } from './themes.js'
import { isColor } from '../colors.js'
import { defaultConfig } from '../config/defaults.js'

test('builtinThemes has the 9 ccstatusline themes with valid colors', () => {
  expect(Object.keys(builtinThemes).sort()).toEqual(
    ['classic', 'default', 'dracula', 'gruvbox', 'monokai', 'nord', 'one-dark', 'solarized', 'tokyo-night'])
  for (const t of Object.values(builtinThemes))
    for (const c of Object.values(t)) {
      if (c.fg !== undefined) expect(isColor(c.fg)).toBe(true)
      if (c.bg !== undefined) expect(isColor(c.bg)).toBe(true)
    }
})
test('defaultConfig folds in all builtin themes, default active', () => {
  expect(Object.keys(defaultConfig.themes)).toHaveLength(9)
  expect(defaultConfig.theme).toBe('default')
})
