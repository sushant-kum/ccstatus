import { expect, test } from 'vitest';

import { isColorIndex } from '../colors.js';
import { defaultConfig } from '../config/defaults.js';

import { builtinThemes } from './themes.js';

test('builtinThemes has the 9 ccstatusline themes with valid colors', () => {
  expect(Object.keys(builtinThemes).sort()).toEqual([
    'classic',
    'default',
    'dracula',
    'gruvbox',
    'monokai',
    'nord',
    'one-dark',
    'solarized',
    'tokyo-night',
  ]);
  for (const theme of Object.values(builtinThemes)) {
    expect(Array.isArray(theme)).toBe(true);
    for (const slot of theme) {
      if (slot.fg !== undefined) {
        expect(isColorIndex(slot.fg)).toBe(true);
      }
      if (slot.bg !== undefined) {
        expect(isColorIndex(slot.bg)).toBe(true);
      }
    }
  }
});

test('defaultConfig folds in all builtin themes, default active', () => {
  expect(Object.keys(defaultConfig.themes)).toHaveLength(9);
  expect(defaultConfig.theme).toBe('default');
});

test('the default theme keeps its exact translated values', () => {
  expect(builtinThemes['default']).toEqual([
    { fg: 16, bg: 44 },
    { fg: 231, bg: 20 },
    { fg: 16, bg: 226 },
    { fg: 231, bg: 240 },
    { fg: 16, bg: 40 },
  ]);
});
