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

test('brightWhite on dark backgrounds (crisp, not dim SGR-37 grey)', () => {
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
    expect(contrastFg(bg)).toBe('brightWhite');
  }
});

test('normalizes the bg prefix and defaults unknown to brightWhite', () => {
  expect(contrastFg('bgCyan')).toBe('black');
  expect(contrastFg('bgBrightGray')).toBe('brightWhite'); // renders uncolored, but fg stays defined
  expect(contrastFg('totally-unknown')).toBe('brightWhite');
  expect(contrastFg('cyan')).toBe('black');
  expect(contrastFg('red')).toBe('brightWhite');
});
