import { expect, test } from 'vitest';

import { asIndex, isColorIndex } from '../colors.js';

import { BLACK, indexToHex, indexToRgb, NAMED_INDEX, WHITE } from './xterm256.js';

test('cube corners and midpoints', () => {
  expect(indexToRgb(asIndex(16))).toEqual([0, 0, 0]); // BLACK
  expect(indexToRgb(asIndex(231))).toEqual([255, 255, 255]); // WHITE
  expect(indexToRgb(asIndex(196))).toEqual([255, 0, 0]);
  expect(indexToRgb(asIndex(46))).toEqual([0, 255, 0]);
  expect(indexToRgb(asIndex(21))).toEqual([0, 0, 255]);
});

test('grayscale ramp', () => {
  expect(indexToRgb(asIndex(232))).toEqual([8, 8, 8]);
  expect(indexToRgb(asIndex(255))).toEqual([238, 238, 238]);
});

test('indexToHex formats 6-digit lowercase hex', () => {
  expect(indexToHex(asIndex(16))).toBe('#000000');
  expect(indexToHex(asIndex(231))).toBe('#ffffff');
  expect(indexToHex(asIndex(196))).toBe('#ff0000');
});

test('BLACK/WHITE constants', () => {
  expect(BLACK).toBe(16);
  expect(WHITE).toBe(231);
});

test('indexToRgb clamps out-of-range input instead of emitting malformed RGB', () => {
  expect(indexToRgb(asIndex(300))).toEqual(indexToRgb(asIndex(255)));
  expect(indexToRgb(asIndex(3))).toEqual([0, 0, 0]);
});

test('every authored table value is a valid ColorIndex (guards the unchecked asIndex casts)', () => {
  expect(isColorIndex(BLACK)).toBe(true);
  expect(isColorIndex(WHITE)).toBe(true);
  for (const idx of NAMED_INDEX.values()) {
    expect(isColorIndex(idx)).toBe(true);
  }
});

test('NAMED_INDEX maps the 16 legacy names into 16–255', () => {
  for (const idx of NAMED_INDEX.values()) {
    expect(Number.isInteger(idx)).toBe(true);
    expect(idx).toBeGreaterThanOrEqual(16);
    expect(idx).toBeLessThanOrEqual(255);
  }
  expect(NAMED_INDEX.get('brightWhite')).toBe(231);
  expect(NAMED_INDEX.get('black')).toBe(16);
  expect(NAMED_INDEX.get('cyan')).toBe(44);
});
