import { expect, test } from 'vitest';

import type { Theme } from '../config/types.js';

import type { Cell } from './cells.js';
import { assignPaletteColors } from './palette.js';

const cell = (text: string, o: Partial<Cell> = {}): Cell => ({
  text,
  merge: false,
  flex: false,
  ...o,
});
const theme: Theme = [
  { fg: 'black', bg: 'bgCyan' },
  { fg: 'white', bg: 'bgBlue' },
];

test('cycles the palette across positions', () => {
  const out = assignPaletteColors([cell('a'), cell('b'), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgBlue', 'bgCyan']);
  expect(out.map((c) => c.fg)).toEqual(['black', 'white', 'black']);
});

test('auto-contrasts a bg-only slot', () => {
  const out = assignPaletteColors([cell('a')], [{ bg: 'bgYellow' }]);
  expect(out[0]).toMatchObject({ bg: 'bgYellow', fg: 'black' });
});

test('an fg-only slot sets fg and no bg', () => {
  const out = assignPaletteColors([cell('a')], [{ fg: 'red' }]);
  expect(out[0]?.fg).toBe('red');
  expect(out[0]?.bg).toBeUndefined();
});

test('merged cell shares the preceding slot and does not advance the counter', () => {
  const out = assignPaletteColors([cell('a'), cell('b', { merge: true }), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgCyan', 'bgBlue']);
});

test('a merge flag on the first cell still takes slot 0', () => {
  const out = assignPaletteColors([cell('a', { merge: true }), cell('b')], theme);
  expect(out.map((c) => c.bg)).toEqual(['bgCyan', 'bgBlue']);
});

test('flex cells are uncolored and consume no slot', () => {
  const out = assignPaletteColors([cell('a'), cell('', { flex: true }), cell('b')], theme);
  expect(out[0]?.bg).toBe('bgCyan');
  expect(out[1]?.bg).toBeUndefined();
  expect(out[1]?.fg).toBeUndefined();
  expect(out[2]?.bg).toBe('bgBlue');
});

test('empty palette leaves cells uncolored', () => {
  const out = assignPaletteColors([cell('a'), cell('b')], []);
  expect(out.every((c) => c.fg === undefined && c.bg === undefined)).toBe(true);
});
