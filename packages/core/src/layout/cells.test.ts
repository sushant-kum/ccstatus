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

test('alignColumns pads each column to its widest cell and left-justifies', () => {
  const out = alignColumns(
    [
      [cell('a'), cell('bbbb')],
      [cell('ccc'), cell('d')],
    ],
    'left',
    1
  );
  expect(out[0]?.map((c) => c.text)).toEqual(['a  ', 'bbbb']);
  expect(out[1]?.map((c) => c.text)).toEqual(['ccc', 'd   ']);
});

test('alignColumns right- and center-justifies by align', () => {
  expect(alignColumns([[cell('a')], [cell('ccc')]], 'right', 1)[0]?.[0]?.text).toBe('  a');
  expect(alignColumns([[cell('a')], [cell('cccc')]], 'center', 1)[0]?.[0]?.text).toBe(' a  ');
});

test('alignColumns skips flex cells and tolerates ragged lines', () => {
  const out = alignColumns([[cell('a'), cell('', true), cell('xx')], [cell('ccc')]], 'left', 1);
  expect(out[0]?.[1]).toEqual({ text: '', merge: false, flex: true }); // flex untouched
  expect(out[0]?.[0]?.text).toBe('a  '); // column 0 widened to width 3 ('ccc')
  expect(out[1]?.[0]?.text).toBe('ccc'); // the widest cell sets the column width
  expect(out[1]).toHaveLength(1); // shorter line unchanged in length
  expect(out[0]?.[2]?.text).toBe('xx'); // column 2 only on line 0 → its own width
});

test('alignColumns does not mutate the input cells', () => {
  const input = [[cell('a')], [cell('ccc')]];
  alignColumns(input, 'left', 1);
  expect(input[0]?.[0]?.text).toBe('a');
});

test('alignColumns pads a merge:true cell and prepends the lost separator width (DEC-0031)', () => {
  const merged: Cell = { text: 'x', merge: true, flex: false };
  const out = alignColumns(
    [
      [cell('a'), merged],
      [cell('ccc'), cell('yyyy')],
    ],
    'left',
    1
  );
  // col1 width 4; merge drops the separator before it, so one leading space is prepended.
  expect(out[0]?.[1]).toEqual({ text: ' x   ', merge: true, flex: false });
  expect(out[0]?.[0]?.text).toBe('a  '); // col0 widened to 3
});

test('alignColumns does not prepend for a merge cell with no mergeable predecessor', () => {
  const firstMerged: Cell = { text: 'x', merge: true, flex: false }; // merge at index 0: no predecessor
  const afterFlex: Cell = { text: 'y', merge: true, flex: false }; // predecessor is flex -> no merge
  const out = alignColumns(
    [
      [firstMerged, cell('bb')],
      [cell('', true), afterFlex],
    ],
    'left',
    1
  );
  expect(out[0]?.[0]?.text).toBe('x'); // index 0: not merged, no prepend (col0 width 1)
  expect(out[1]?.[1]?.text).toBe('y '); // predecessor flex: not merged, no prepend (col1 width 2)
});

test('alignColumns prepends for each of consecutive merge cells (DEC-0031)', () => {
  const m1: Cell = { text: 'b', merge: true, flex: false };
  const m2: Cell = { text: 'c', merge: true, flex: false }; // predecessor m1 is non-flex -> also merges
  const out = alignColumns(
    [
      [cell('a'), m1, m2],
      [cell('aaa'), cell('bbb'), cell('ccc')],
    ],
    'left',
    1
  );
  // willMerge reads the raw predecessor, so m2's check sees m1 (non-flex) regardless of folding.
  expect(out[0]?.[1]?.text).toBe(' b  '); // col1 width 3, +1 prepend
  expect(out[0]?.[2]?.text).toBe(' c  '); // col2 width 3, +1 prepend
});
