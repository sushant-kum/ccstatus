// cspell:ignore bbcc
import { expect, test } from 'vitest';

import type { Config } from '../config/types.js';
import type { Snapshot } from '../snapshot.js';

import { alignColumns, itemToCell, lineToCells, type Cell } from './cells.js';
import '../widgets/data-widgets.js';
import '../widgets/git-widgets.js';
import '../widgets/custom-widgets.js';

const config = {
  theme: 'default',
  themes: { default: [{ fg: 16, bg: 44 }] },
  defaults: { separator: 'powerline', padding: 1, align: 'left' },
} as unknown as Config;
const snap = { model: 'Opus', repo: false } as unknown as Snapshot;

test('itemToCell pads (palette colors are applied downstream)', () => {
  expect(itemToCell({ id: 'a', type: 'model' }, config, snap, {})).toEqual({
    text: ' Opus ',
    merge: false,
    flex: false,
  });
});
test('omitted widget yields null', () => {
  expect(itemToCell({ id: 'g', type: 'git-branch' }, config, snap, {})).toBeNull();
});
test('flex cell is unpadded and flagged', () => {
  expect(itemToCell({ id: 'f', type: 'flex-separator' }, config, snap, {})).toEqual({
    text: '',
    merge: false,
    flex: true,
  });
});
test('negative padding does not throw', () => {
  const badConfig = {
    ...config,
    defaults: { ...config.defaults, padding: -1 },
  } as unknown as Config;
  expect(() => itemToCell({ id: 'a', type: 'model' }, badConfig, snap, {})).not.toThrow();
});
test('lineToCells drops nulls', () => {
  const cells = lineToCells(
    [
      { id: 'a', type: 'model' },
      { id: 'g', type: 'git-branch' },
    ],
    config,
    snap,
    {}
  );
  expect(cells).toHaveLength(1);
});

const cell = (text: string, flex = false): Cell => ({ text, merge: false, flex });
const mergeCell = (text: string): Cell => ({ text, merge: true, flex: false });

test('alignColumns pads each column to its widest cell and left-justifies', () => {
  const out = alignColumns(
    [
      [cell('a'), cell('bbbb')],
      [cell('ccc'), cell('d')],
    ],
    'left'
  );
  expect(out[0]?.map((c) => c.text)).toEqual(['a  ', 'bbbb']);
  expect(out[1]?.map((c) => c.text)).toEqual(['ccc', 'd   ']);
});

test('alignColumns right- and center-justifies by align', () => {
  expect(alignColumns([[cell('a')], [cell('ccc')]], 'right')[0]?.[0]?.text).toBe('  a');
  expect(alignColumns([[cell('a')], [cell('cccc')]], 'center')[0]?.[0]?.text).toBe(' a  ');
});

test('alignColumns skips flex cells and tolerates ragged lines', () => {
  const out = alignColumns([[cell('a'), cell('', true), cell('xx')], [cell('ccc')]], 'left');
  expect(out[0]?.[1]).toEqual({ text: '', merge: false, flex: true }); // flex untouched
  expect(out[0]?.[0]?.text).toBe('a  '); // column 0 widened to width 3 ('ccc')
  expect(out[1]?.[0]?.text).toBe('ccc'); // the widest cell sets the column width
  expect(out[1]).toHaveLength(1); // shorter line unchanged in length
  expect(out[0]?.[2]?.text).toBe('xx'); // column 2 only on line 0 → its own width
});

test('alignColumns does not mutate the input cells', () => {
  const input = [[cell('a')], [cell('ccc')]];
  alignColumns(input, 'left');
  expect(input[0]?.[0]?.text).toBe('a');
});

test('alignColumns sizes a visual column to a merged run and pads siblings to it (DEC-0032)', () => {
  const out = alignColumns(
    [
      [cell('A'), cell('bb'), mergeCell('cc'), cell('Z')], // visual: [A][bbcc][Z]
      [cell('A'), cell('b'), cell('Z')], // visual: [A][b][Z]
    ],
    'left'
  );
  // visual col 1 width = merged "bb"+"cc" = 4; the merged run is already full, siblings pad up to it.
  expect(out[0]?.map((c) => c.text)).toEqual(['A', 'bb', 'cc', 'Z']);
  expect(out[1]?.map((c) => c.text)).toEqual(['A', 'b   ', 'Z']);
});

test('alignColumns pads a merged run that is not the widest on its last member (DEC-0032)', () => {
  const out = alignColumns(
    [
      [cell('A'), cell('bb'), mergeCell('cc')], // merged run width 4
      [cell('A'), cell('wwwwww')], // single widget width 6 sets the column
    ],
    'left'
  );
  // deficit of 2 lands on the run's last member so the merged block stays contiguous.
  expect(out[0]?.map((c) => c.text)).toEqual(['A', 'bb', 'cc  ']);
  expect(out[1]?.map((c) => c.text)).toEqual(['A', 'wwwwww']);
});

test('alignColumns splits a merged run deficit across its edge members by align (DEC-0032)', () => {
  const grid = (): Cell[][] => [
    [cell('A'), cell('bb'), mergeCell('cc')], // merged run width 4
    [cell('A'), cell('wwwwww')], // width 6 sets col1; deficit on the merged run is 2
  ];
  // center: lead member gets floor(2/2)=1 left pad, last member gets the remaining 1 right pad.
  expect(alignColumns(grid(), 'center')[0]?.map((c) => c.text)).toEqual(['A', ' bb', 'cc ']);
  // right: the whole deficit prepends to the lead member; the last member is untouched.
  expect(alignColumns(grid(), 'right')[0]?.map((c) => c.text)).toEqual(['A', '  bb', 'cc']);
});

test('alignColumns takes the widest run across 3+ lines', () => {
  const out = alignColumns(
    [
      [cell('a'), cell('b')],
      [cell('a'), cell('bbbbb')], // a middle line sets the column width
      [cell('a'), cell('bb')],
    ],
    'left'
  );
  expect(out[0]?.[1]?.text).toBe('b    '); // padded up to 5
  expect(out[1]?.[1]?.text).toBe('bbbbb');
  expect(out[2]?.[1]?.text).toBe('bb   ');
});

test('alignColumns groups consecutive merges into one run and pads it as a unit (DEC-0032)', () => {
  const out = alignColumns(
    [
      [cell('a'), mergeCell('b'), mergeCell('c'), cell('Z')], // visual: [abc][Z]
      [cell('aaaa'), cell('Z')], // [aaaa][Z]
    ],
    'left'
  );
  // col 0 width = max("a"+"b"+"c"=3, "aaaa"=4) = 4; the run's deficit of 1 lands on last member "c".
  expect(out[0]?.map((c) => c.text)).toEqual(['a', 'b', 'c ', 'Z']);
  expect(out[1]?.map((c) => c.text)).toEqual(['aaaa', 'Z']);
});

test('alignColumns does not group a merge cell with no mergeable predecessor', () => {
  const out = alignColumns(
    [
      [mergeCell('x'), cell('bb')], // merge at index 0: no predecessor -> its own run
      [cell('', true), mergeCell('y')], // predecessor is flex -> not merged, its own run
    ],
    'left'
  );
  expect(out[0]?.[0]?.text).toBe('x'); // col0 width 1 (x only; the flex row contributes nothing)
  expect(out[1]?.[1]?.text).toBe('y '); // col1 width 2 (bb); "y" padded, not prepended
});
