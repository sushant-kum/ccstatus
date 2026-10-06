import { expect, test } from 'vitest';

import { isColor } from './colors.js';

test('isColor', () => {
  expect(isColor('red')).toBe(true);
  expect(isColor('bgBrightYellow')).toBe(true);
  expect(isColor('fuchsia')).toBe(false);
  expect(isColor(42)).toBe(false);
});
