import { expect, test } from 'vitest';

import { toAnsi } from './ansi.js';

test('wraps colored segments and resets', () => {
  const out = toAnsi({
    lines: [{ segments: [{ kind: 'cell', text: 'hi', fg: 'red', bg: 'bgBlue' }] }],
  });
  expect(out).toBe('\x1b[31m\x1b[44mhi\x1b[0m');
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
