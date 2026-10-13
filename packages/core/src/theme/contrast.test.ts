import { expect, test } from 'vitest';

import { contrastFg } from './contrast.js';

test('black (16) on light backgrounds', () => {
  for (const bg of [44 /* cyan */, 184 /* yellow */, 40 /* green */, 231 /* white */, 226]) {
    expect(contrastFg(bg)).toBe(16);
  }
});

test('white (231) on dark backgrounds', () => {
  for (const bg of [20 /* blue */, 160 /* red */, 164 /* magenta */, 240 /* grey */, 16]) {
    expect(contrastFg(bg)).toBe(231);
  }
});
