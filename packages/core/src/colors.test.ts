import { expect, test } from 'vitest';

import { isColorIndex } from './colors.js';

test('accepts 16–255 integers, rejects 0–15, out-of-range, and non-integers', () => {
  expect(isColorIndex(16)).toBe(true);
  expect(isColorIndex(255)).toBe(true);
  expect(isColorIndex(45)).toBe(true);
  expect(isColorIndex(15)).toBe(false);
  expect(isColorIndex(0)).toBe(false);
  expect(isColorIndex(256)).toBe(false);
  expect(isColorIndex(-1)).toBe(false);
  expect(isColorIndex(1.5)).toBe(false);
  expect(isColorIndex('45')).toBe(false);
  expect(isColorIndex(undefined)).toBe(false);
});
