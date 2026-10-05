import { expect, test } from 'vitest';

import { toAnsi } from '../ansi.js';

import type { Cell } from './cells.js';
import { composeLine } from './compose.js';

const cell = (text: string, bg?: string, extra: Partial<Cell> = {}): Cell => ({
  text,
  bg,
  merge: false,
  flex: false,
  ...extra,
});
const visible = (segs: { text: string }[]): number => segs.map((s) => s.text).join('').length;

test('powerline inserts separators colored prevBg/nextBg plus caps', () => {
  const segs = composeLine([cell(' a ', 'bgRed'), cell(' b ', 'bgBlue')], 'powerline', 100);
  expect(segs.map((s) => s.kind)).toEqual(['cap', 'cell', 'separator', 'cell', 'cap']);
  const sep = segs[2];
  expect(sep).toMatchObject({ text: '▒', fg: 'red', bg: 'bgBlue' });
});

test('space mode joins with single spaces, no caps', () => {
  const segs = composeLine([cell('a'), cell('b')], 'space', 100);
  expect(segs.map((s) => s.text).join('')).toBe('a b');
  expect(segs.some((s) => s.kind === 'cap')).toBe(false);
});

test('merge concatenates onto previous cell with no separator', () => {
  const segs = composeLine(
    [cell(' a ', 'bgRed'), cell('b', 'bgRed', { merge: true })],
    'powerline',
    100
  );
  const cells = segs.filter((s) => s.kind === 'cell');
  expect(cells).toHaveLength(1);
  expect(cells[0]?.text).toBe(' a b');
});

test('flex distributes leftover width', () => {
  const segs = composeLine(
    [cell('ab'), cell('', undefined, { flex: true }), cell('cd')],
    'none',
    10
  );
  const flex = segs.find((s) => s.kind === 'flex');
  expect(flex?.text).toBe('      '); // 10 - 4 content = 6 spaces
});

test('multiple flex separators split the leftover, giving the remainder to the first', () => {
  // width 11, content 'ab'+'cd' = 4, two flex separators share leftover 7 → 4 and 3.
  const segs = composeLine(
    [
      cell('ab'),
      cell('', undefined, { flex: true }),
      cell('cd'),
      cell('', undefined, { flex: true }),
    ],
    'none',
    11
  );
  const flexes = segs.filter((s) => s.kind === 'flex');
  expect(flexes.map((f) => f.text.length)).toEqual([4, 3]);
  expect(visible(segs)).toBe(11); // fills exactly
});

test('flex accounts for powerline caps and separators when sizing', () => {
  // powerline over one content cell + a flex: caps (2) + content (3) consume width.
  const segs = composeLine(
    [cell(' a ', 'bgRed'), cell('', undefined, { flex: true })],
    'powerline',
    10
  );
  expect(visible(segs)).toBeLessThanOrEqual(10);
  const flex = segs.find((s) => s.kind === 'flex');
  expect(flex?.text.length).toBe(10 - 3 - 2); // width - content - (startCap+endCap)
});

test('truncation keeps visible width within bounds and never throws', () => {
  const segs = composeLine([cell(' hello '), cell(' world ')], 'powerline', 6);
  expect(visible(segs)).toBeLessThanOrEqual(6);
  expect(() => composeLine([cell('x')], 'powerline', 0)).not.toThrow();
});

test('a truncated powerline line does not end on a dangling separator', () => {
  const segs = composeLine(
    [cell(' aaa ', 'bgRed'), cell(' bbb ', 'bgBlue'), cell(' ccc ', 'bgGreen')],
    'powerline',
    8
  );
  expect(visible(segs)).toBeLessThanOrEqual(8);
  if (segs.length) {
    expect(segs[segs.length - 1]?.kind).not.toBe('separator');
  }
});

test('powerline separator reaches ANSI with both fg and bg SGR codes', () => {
  const segs = composeLine([cell(' a ', 'bgRed'), cell(' b ', 'bgBlue')], 'powerline', 100);
  const out = toAnsi({ lines: [{ segments: segs }] });
  expect(out).toContain('\x1b[31m\x1b[44m▒');
});
