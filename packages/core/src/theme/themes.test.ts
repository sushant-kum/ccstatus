import { expect, test } from 'vitest';

import { isColor } from '../colors.js';
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
        expect(isColor(slot.fg)).toBe(true);
      }
      if (slot.bg !== undefined) {
        expect(isColor(slot.bg)).toBe(true);
      }
    }
  }
});

test('defaultConfig folds in all builtin themes, default active', () => {
  expect(Object.keys(defaultConfig.themes)).toHaveLength(9);
  expect(defaultConfig.theme).toBe('default');
});

test('no builtin theme uses dim plain white for text (DEC-0022)', () => {
  // 'white' is SGR 37 (a dim grey); light text must be 'brightWhite' (SGR 97).
  // 'bgWhite' is a legitimate light background, so only the fg is guarded.
  for (const [name, theme] of Object.entries(builtinThemes)) {
    for (const slot of theme) {
      expect(slot.fg, `${name} slot fg`).not.toBe('white');
    }
  }
});
