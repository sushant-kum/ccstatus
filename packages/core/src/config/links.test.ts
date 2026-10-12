import { expect, test } from 'vitest';

import { defaultConfig } from './defaults.js';
import { linkedSurfaces, writeLinkedLines } from './links.js';
import type { Config } from './types.js';

const surfaces = (): Config['surfaces'] => structuredClone(defaultConfig.surfaces);
const line = (): Config['surfaces']['band']['lines'] => [[{ id: 'a', type: 'model' }]];

test('linkedSurfaces returns the linked surfaces in canonical order', () => {
  const s = surfaces();
  s.pane.linked = true;
  s.band.linked = true;
  expect(linkedSurfaces(s)).toEqual(['band', 'pane']);
});

test('linkedSurfaces returns empty when none are linked', () => {
  expect(linkedSurfaces(surfaces())).toEqual([]);
});

test('writeLinkedLines writes only the target surface when it is not linked', () => {
  const s = surfaces();
  const lines = line();
  const next = writeLinkedLines(s, 'band', lines);
  expect(next.band.lines).toBe(lines); // source keeps the passed ref (not cloned)
  expect(next.statusline.lines).toEqual(s.statusline.lines); // untouched
  expect(next).not.toBe(s); // a new surfaces map
});

test('writeLinkedLines mirrors to linked members with deep clones', () => {
  const s = surfaces();
  s.band.linked = true;
  s.pane.linked = true;
  const lines = line();
  const next = writeLinkedLines(s, 'band', lines);
  expect(next.pane.lines).toEqual(lines);
  expect(next.pane.lines).not.toBe(lines); // cloned, not shared
  expect(next.statusline.lines).toEqual(s.statusline.lines); // unlinked, untouched
});

test('writeLinkedLines does not propagate from an unlinked surface', () => {
  const s = surfaces();
  s.statusline.linked = true;
  s.pane.linked = true;
  const lines = line();
  const next = writeLinkedLines(s, 'band', lines); // band is not linked
  expect(next.band.lines).toBe(lines);
  expect(next.statusline.lines).toEqual(s.statusline.lines); // untouched
  expect(next.pane.lines).toEqual(s.pane.lines); // untouched
});
