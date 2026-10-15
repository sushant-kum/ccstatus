// cspell:ignore bbcc Abbcc
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

// A merged widget pair (model+effort, weekly+reset in the real bar) collapses two items into one
// visual cell, so a row with a merge has the SAME number of visual columns as a row of singles. The
// grid aligns by those visual columns: the merged pair sets its column's width and sibling cells span
// it; items after a merge still line up though the merge shifted their raw item index (DEC-0032).
const gridCfg = (separator: 'space' | 'none' | 'powerline'): typeof defaultConfig => {
  const cfg = JSON.parse(JSON.stringify(defaultConfig)) as typeof defaultConfig;
  cfg.defaults = { ...cfg.defaults, separator, padding: 0, alignColumns: true, align: 'left' };
  cfg.surfaces.band.lines = [
    // row 0: col 1 is a merged pair "bb"+"cc" -> visual cells [A][bbcc][Z]
    [
      { id: 'a0', type: 'custom-text', text: 'A' },
      { id: 'a1', type: 'custom-text', text: 'bb' },
      { id: 'a2', type: 'custom-text', text: 'cc', merge: true },
      { id: 'a3', type: 'custom-text', text: 'Z' },
    ],
    // row 1: col 1 is a single widget "b" -> visual cells [A][b][Z]
    [
      { id: 'b0', type: 'custom-text', text: 'A' },
      { id: 'b1', type: 'custom-text', text: 'b' },
      { id: 'b2', type: 'custom-text', text: 'Z' },
    ],
  ];
  return cfg;
};
const fullLine = (model: ReturnType<typeof render>, li: number): string =>
  model.lines[li]?.segments.map((s) => s.text).join('') ?? '';

test('alignColumns sizes a visual column to a merged pair and spans sibling cells to it', () => {
  const model = render(gridCfg('space'), snap, { surface: 'band', width: 120 });
  // col 1 width = merged "bbcc" (4), so row 1's single "b" pads to 4 and the last column lines up.
  const z0 = fullLine(model, 0).indexOf('Z');
  const z1 = fullLine(model, 1).indexOf('Z');
  expect(z0).toBeGreaterThanOrEqual(0); // guard against a -1 === -1 false pass
  expect(z1).toBe(z0);
  expect(fullLine(model, 0)).toBe('A bbcc Z'); // merged pair fills its column
  expect(fullLine(model, 1)).toBe('A b    Z'); // sibling padded to the merged column width
});

test('alignColumns aligns by visual column under separator none', () => {
  const model = render(gridCfg('none'), snap, { surface: 'band', width: 120 });
  expect(fullLine(model, 0)).toBe('AbbccZ');
  expect(fullLine(model, 1)).toBe('Ab   Z'); // "b" padded to the 4-wide merged column, no separators
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
