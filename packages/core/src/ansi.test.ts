import { expect, test } from 'vitest';

import { toAnsi } from './ansi.js';
import { asIndex } from './colors.js';
import type { ColorIndex } from './colors.js';

test('wraps colored segments and resets', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: asIndex(16), bg: asIndex(44) }] }],
  });
  expect(out).toBe('\x1b[38;5;16m\x1b[48;5;44mhi\x1b[0m');
});
test('uncolored segment is plain', () => {
  expect(toAnsi({ lines: [{ segments: [{ kind: 'cell', text: 'x' }] }] })).toBe('x');
});
test('multiple lines joined by newline', () => {
  const out = toAnsi({
    lines: [
      { segments: [{ kind: 'cell', text: 'a' }] },
      { segments: [{ kind: 'cell', text: 'b' }] },
    ],
  });
  expect(out).toBe('a\nb');
});
test('emits the 256-color form (38;5;/48;5;), not basic 30–47/90–107 codes', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: asIndex(231), bg: asIndex(20) }] }],
  });
  const esc = String.fromCharCode(27);
  expect(out).not.toMatch(new RegExp(`${esc}\\[(3|4|9|10)[0-7]m`));
  for (const m of out.matchAll(new RegExp(`${esc}\\[[34]8;5;(\\d+)m`, 'g'))) {
    expect(Number(m[1])).toBeGreaterThan(15);
  }
});
test('clamps an out-of-range index so a low (dimming) code is never emitted', () => {
  const out = toAnsi({
    lines: [
      { segments: [{ kind: 'cell', text: 'x', fg: 3 as ColorIndex, bg: 300 as ColorIndex }] },
    ],
  });
  expect(out).toBe('\x1b[38;5;16m\x1b[48;5;255mx\x1b[0m');
});
