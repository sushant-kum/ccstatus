import { expect, test } from 'vitest';

import { toAnsi } from './ansi.js';

test('wraps colored segments and resets', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: 16, bg: 44 }] }],
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
test('emits only 256-color codes, never basic or low-index ones', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: 231, bg: 20 }] }],
  });
  const esc = String.fromCharCode(27);
  expect(out).not.toMatch(new RegExp(`${esc}\\[(3|4|9|10)[0-7]m`));
  for (const m of out.matchAll(new RegExp(`${esc}\\[[34]8;5;(\\d+)m`, 'g'))) {
    expect(Number(m[1])).toBeGreaterThan(15);
  }
});
