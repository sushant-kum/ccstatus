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
  { fg: 16, bg: 44 },
  { fg: 231, bg: 20 },
];

test('cycles the palette across positions', () => {
  const out = assignPaletteColors([cell('a'), cell('b'), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual([44, 20, 44]);
  expect(out.map((c) => c.fg)).toEqual([16, 231, 16]);
});

test('auto-contrasts a bg-only slot', () => {
  const out = assignPaletteColors([cell('a')], [{ bg: 184 }]);
  expect(out[0]).toMatchObject({ bg: 184, fg: 16 });
});

test('an fg-only slot sets fg and no bg', () => {
  const out = assignPaletteColors([cell('a')], [{ fg: 160 }]);
  expect(out[0]?.fg).toBe(160);
  expect(out[0]?.bg).toBeUndefined();
});

test('an explicit fg wins over the auto-contrast color when a slot sets both fg and bg', () => {
  // contrastFg(44) is 16; the slot's explicit 160 must take precedence.
  const out = assignPaletteColors([cell('a')], [{ fg: 160, bg: 44 }]);
  expect(out[0]).toMatchObject({ fg: 160, bg: 44 });
});

test('merged cell shares the preceding slot and does not advance the counter', () => {
  const out = assignPaletteColors([cell('a'), cell('b', { merge: true }), cell('c')], theme);
  expect(out.map((c) => c.bg)).toEqual([44, 44, 20]);
});

test('a merge flag on the first cell still takes slot 0', () => {
  const out = assignPaletteColors([cell('a', { merge: true }), cell('b')], theme);
  expect(out.map((c) => c.bg)).toEqual([44, 20]);
});

test('flex cells are uncolored and consume no slot', () => {
  const out = assignPaletteColors([cell('a'), cell('', { flex: true }), cell('b')], theme);
  expect(out[0]?.bg).toBe(44);
  expect(out[1]?.bg).toBeUndefined();
  expect(out[1]?.fg).toBeUndefined();
  expect(out[2]?.bg).toBe(20);
});

test('empty palette leaves cells uncolored', () => {
  const out = assignPaletteColors([cell('a'), cell('b')], []);
  expect(out.every((c) => c.fg === undefined && c.bg === undefined)).toBe(true);
});

test('a merge immediately after a flex separator is not a continuation', () => {
  const out = assignPaletteColors(
    [cell('a'), cell('', { flex: true }), cell('b', { merge: true })],
    theme
  );
  expect(out[0]?.bg).toBe(44); // slot 0
  expect(out[2]?.bg).toBe(20); // slot 1 — NOT shared with 'a'
});
