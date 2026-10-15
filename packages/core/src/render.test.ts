import { expect, test } from 'vitest';

import { defaultConfig } from './config/defaults.js';
import { render } from './render.js';
import type { Snapshot } from './snapshot.js';

const snap: Snapshot = {
  version: '2.1.0',
  model: 'Opus',
  effort: null,
  cwd: '/x/app',
  repo: false,
  gitRoot: '',
  gitBranch: '',
  gitWorktree: '',
  added: 0,
  modified: 0,
  deleted: 0,
  insertions: 0,
  deletions: 0,
  ctxTokens: 42000,
  ctxPct: 21,
  cached: 0,
  input: 0,
  output: 0,
  total: 0,
  startedAt: 0,
  cost: null,
  fivePct: null,
  fiveReset: null,
  weekPct: null,
  weekReset: null,
  blockReset: null,
  terminalWidth: 120,
  sessionId: '',
  ctxWindow: 0,
  gitSha: '',
  outputStyle: null,
  now: 0,
};

test('band renders the default line', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 120 });
  expect(model.lines).toHaveLength(1);
  const [line] = model.lines;
  if (!line) {
    throw new Error('expected a rendered line');
  }
  const text = line.segments.map((s) => s.text).join('');
  expect(text).toContain('v2.1.0');
  expect(text).toContain('Opus');
  expect(text).toContain('Ctx: 42k');
});

test('disabled surface renders nothing', () => {
  const model = render(defaultConfig, snap, { surface: 'statusline', width: 120 });
  expect(model.lines).toEqual([]);
});

test('render uses the configured powerline glyph', () => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  cfg.defaults.glyph = '►';
  const model = render(cfg, snap, { surface: 'band', width: 120 });
  const [line] = model.lines;
  if (!line) {
    throw new Error('expected a rendered line');
  }
  const text = line.segments.map((s) => s.text).join('');
  expect(text).toContain('►');
  expect(text).not.toContain('▒');
});

test('the palette counter resets per line', () => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  // Two identical single-item lines: each must restart at slot 0, so both get the same bg.
  cfg.surfaces.band.lines = [[{ id: 'a', type: 'model' }], [{ id: 'b', type: 'model' }]];
  const model = render(cfg, snap, { surface: 'band', width: 120 });
  expect(model.lines).toHaveLength(2);
  const firstBg = (li: number): number | undefined =>
    model.lines[li]?.segments.find((s) => s.kind === 'cell')?.bg;
  expect(firstBg(0)).toBeDefined();
  expect(typeof firstBg(0)).toBe('number');
  expect(firstBg(1)).toBe(firstBg(0)); // line 2 did not continue line 1's counter
});

// Two-line band of fixed-width custom-text cells, laid out with the `space` separator so each
// rendered 'cell' segment's text is exactly the (possibly padded) cell text — no caps/powerline.
const twoLineCfg = (
  alignColumns: boolean,
  align: 'left' | 'center' | 'right'
): typeof defaultConfig => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  cfg.defaults = { ...cfg.defaults, separator: 'space', alignColumns, align };
  cfg.surfaces.band.lines = [
    [
      { id: 'a0', type: 'custom-text', text: 'a' },
      { id: 'a1', type: 'custom-text', text: 'bbbb' },
    ],
    [
      { id: 'b0', type: 'custom-text', text: 'ccc' },
      { id: 'b1', type: 'custom-text', text: 'd' },
    ],
  ];
  return cfg;
};
const cellTexts = (model: ReturnType<typeof render>, li: number): string[] =>
  model.lines[li]?.segments.filter((s) => s.kind === 'cell').map((s) => s.text) ?? [];

test('alignColumns on: cells pad to shared column widths across lines', () => {
  const model = render(twoLineCfg(true, 'left'), snap, { surface: 'band', width: 120 });
  const l0 = cellTexts(model, 0);
  const l1 = cellTexts(model, 1);
  expect(l0.map((t) => t.length)).toEqual(l1.map((t) => t.length)); // columns line up
  expect(l0).toEqual([' a   ', ' bbbb ']); // col0 padded 3->5, left-justified
  expect(l1).toEqual([' ccc ', ' d    ']); // col1 padded 3->6
});

test('alignColumns threads defaults.align through render (right-justifies)', () => {
  const model = render(twoLineCfg(true, 'right'), snap, { surface: 'band', width: 120 });
  expect(cellTexts(model, 0)[0]).toBe('   a '); // padding on the left, not a hard-coded "left"
  expect(cellTexts(model, 1)[1]).toBe('    d ');
});

test('alignColumns off: columns stay ragged (the default no-op path)', () => {
  const model = render(twoLineCfg(false, 'left'), snap, { surface: 'band', width: 120 });
  expect(cellTexts(model, 0)[0]).toBe(' a '); // unpadded
  expect(cellTexts(model, 1)[0]).toBe(' ccc ');
});

test('alignColumns keeps columns aligned across a row with a merged cell', () => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  cfg.defaults = {
    ...cfg.defaults,
    separator: 'space',
    padding: 0,
    alignColumns: true,
    align: 'left',
  };
  cfg.surfaces.band.lines = [
    [
      { id: 'a0', type: 'custom-text', text: 'aa' },
      { id: 'a1', type: 'custom-text', text: 'bb' },
      { id: 'a2', type: 'custom-text', text: 'ZZ' },
    ],
    [
      { id: 'b0', type: 'custom-text', text: 'dd' },
      { id: 'b1', type: 'custom-text', text: 'ee', merge: true }, // merges into b0 (no separator)
      { id: 'b2', type: 'custom-text', text: 'YY' },
    ],
  ];
  const model = render(cfg, snap, { surface: 'band', width: 120 });
  const full = (li: number): string => model.lines[li]?.segments.map((s) => s.text).join('') ?? '';
  // the last column must start at the same x on both lines, despite line 2's merged cell
  const col2 = full(0).indexOf('ZZ');
  expect(col2).toBeGreaterThanOrEqual(0); // guard against a -1 === -1 false pass
  expect(full(1).indexOf('YY')).toBe(col2);
});

test('alignColumns with separator none needs no merge compensation (sepWidth 0)', () => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  cfg.defaults = {
    ...cfg.defaults,
    separator: 'none',
    padding: 0,
    alignColumns: true,
    align: 'left',
  };
  cfg.surfaces.band.lines = [
    [
      { id: 'a0', type: 'custom-text', text: 'aa' },
      { id: 'a1', type: 'custom-text', text: 'bb' },
      { id: 'a2', type: 'custom-text', text: 'ZZ' },
    ],
    [
      { id: 'b0', type: 'custom-text', text: 'dd' },
      { id: 'b1', type: 'custom-text', text: 'ee', merge: true }, // no separator exists to drop
      { id: 'b2', type: 'custom-text', text: 'YY' },
    ],
  ];
  const model = render(cfg, snap, { surface: 'band', width: 120 });
  const full = (li: number): string => model.lines[li]?.segments.map((s) => s.text).join('') ?? '';
  // sepWidth is 0 under 'none', so the merge cell must NOT gain a phantom leading space.
  const col2 = full(0).indexOf('ZZ');
  expect(col2).toBeGreaterThanOrEqual(0);
  expect(full(1).indexOf('YY')).toBe(col2);
});

test('positional palette colors every segment and alternates backgrounds', () => {
  const model = render(defaultConfig, snap, { surface: 'band', width: 120 });
  const [line] = model.lines;
  if (!line) {
    throw new Error('expected a rendered line');
  }
  const cells = line.segments.filter((s) => s.kind === 'cell');
  expect(cells.length).toBeGreaterThanOrEqual(2);
  for (const c of cells) {
    expect(typeof c.bg).toBe('number'); // no terminal-default grey
    expect(typeof c.fg).toBe('number');
  }
  expect(cells[0]?.bg).not.toBe(cells[1]?.bg); // positional alternation
});
