import { expect, test } from 'vitest';

import { asIndex, isColorIndex } from '../colors.js';
import { defaultConfig } from '../config/defaults.js';
import type { Theme } from '../config/types.js';

import { builtinThemes, withBuiltinThemes } from './themes.js';

// Build a palette from raw index pairs (slots need the branded ColorIndex — DEC-0025).
const pal = (rows: [number, number][]): Theme =>
  rows.map(([fg, bg]) => ({ fg: asIndex(fg), bg: asIndex(bg) }));

test('builtinThemes is `default` plus ccstatusline’s 10 themes, with valid colors', () => {
  expect(Object.keys(builtinThemes).sort()).toEqual([
    'catppuccin',
    'default',
    'dracula',
    'gruvbox',
    'minimal',
    'monokai',
    'nord',
    'nord-aurora',
    'onedark',
    'solarized',
    'tokyonight',
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
  expect(Object.keys(defaultConfig.themes)).toHaveLength(11);
  expect(defaultConfig.theme).toBe('default');
});

test('the default theme keeps its exact values (ccstatus’s own, not a ccstatusline theme)', () => {
  expect(builtinThemes['default']).toEqual([
    { fg: 16, bg: 44 },
    { fg: 231, bg: 20 },
    { fg: 16, bg: 226 },
    { fg: 231, bg: 240 },
    { fg: 16, bg: 40 },
  ]);
});

test('nord matches ccstatusline’s ansi256 palette', () => {
  expect(builtinThemes['nord']).toEqual([
    { fg: 16, bg: 73 },
    { fg: 254, bg: 239 },
    { fg: 231, bg: 25 },
    { fg: 231, bg: 96 },
    { fg: 16, bg: 152 },
  ]);
});

test('withBuiltinThemes refreshes an unmodified legacy built-in to the new palette', () => {
  // the pre-adoption `nord` palette, verbatim as an old config would hold it
  const legacyNord = pal([
    [16, 51],
    [16, 44],
    [16, 20],
    [231, 240],
    [16, 21],
    [16, 40],
    [16, 184],
    [231, 16],
  ]);
  const out = withBuiltinThemes({ nord: legacyNord });
  expect(out['nord']).toEqual(builtinThemes['nord']); // refreshed, not the legacy 8-slot palette
  expect(out['catppuccin']).toEqual(builtinThemes['catppuccin']); // new built-ins added
  expect(out['classic']).toBeUndefined(); // dropped legacy built-in
});

test('withBuiltinThemes keeps a user-edited built-in and custom themes untouched', () => {
  const editedNord = pal([[231, 160]]); // not the legacy palette
  const mine = pal([[200, 100]]);
  const out = withBuiltinThemes({ nord: editedNord, mine });
  expect(out['nord']).toEqual(editedNord); // preserved — not refreshed
  expect(out['mine']).toEqual(mine); // custom theme preserved
  expect(out['default']).toEqual(builtinThemes['default']); // built-ins still present
});
