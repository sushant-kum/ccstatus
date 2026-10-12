import { expect, test } from 'vitest';

import { contrastFg } from './contrast.js';

test('black on light backgrounds', () => {
  for (const bg of [
    'bgCyan',
    'bgYellow',
    'bgGreen',
    'bgWhite',
    'bgBrightYellow',
    'bgBrightCyan',
    'bgBrightGreen',
    'bgBrightWhite',
  ]) {
    expect(contrastFg(bg)).toBe('black');
  }
});

test('white on dark backgrounds', () => {
  for (const bg of [
    'bgBlack',
    'bgRed',
    'bgBlue',
    'bgMagenta',
    'bgBrightBlack',
    'bgBrightRed',
    'bgBrightBlue',
    'bgBrightMagenta',
  ]) {
    expect(contrastFg(bg)).toBe('white');
  }
});

test('normalizes the bg prefix and defaults unknown to white', () => {
  expect(contrastFg('bgCyan')).toBe('black');
  expect(contrastFg('bgBrightGray')).toBe('white'); // renders uncolored, but fg stays defined
  expect(contrastFg('totally-unknown')).toBe('white');
});
