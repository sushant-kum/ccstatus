import { expect, test } from 'vitest';

import { BLACK, indexToHex, indexToRgb, NAMED_INDEX, WHITE } from './xterm256.js';

test('cube corners and midpoints', () => {
  expect(indexToRgb(16)).toEqual([0, 0, 0]); // BLACK
  expect(indexToRgb(231)).toEqual([255, 255, 255]); // WHITE
  expect(indexToRgb(196)).toEqual([255, 0, 0]);
  expect(indexToRgb(46)).toEqual([0, 255, 0]);
  expect(indexToRgb(21)).toEqual([0, 0, 255]);
});

test('grayscale ramp', () => {
  expect(indexToRgb(232)).toEqual([8, 8, 8]);
  expect(indexToRgb(255)).toEqual([238, 238, 238]);
});

test('indexToHex formats 6-digit lowercase hex', () => {
  expect(indexToHex(16)).toBe('#000000');
  expect(indexToHex(231)).toBe('#ffffff');
  expect(indexToHex(196)).toBe('#ff0000');
});

test('BLACK/WHITE constants', () => {
  expect(BLACK).toBe(16);
  expect(WHITE).toBe(231);
});

test('NAMED_INDEX maps the 16 legacy names into 16–255', () => {
  for (const idx of Object.values(NAMED_INDEX)) {
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(16);
    expect(idx).toBeLessThanOrEqual(255);
  }
  expect(NAMED_INDEX['brightWhite']).toBe(231);
  expect(NAMED_INDEX['black']).toBe(16);
  expect(NAMED_INDEX['cyan']).toBe(44);
});
