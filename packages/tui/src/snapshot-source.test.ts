import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { sampleSnapshot } from './sample-snapshot.js';
import { readSnapshot } from './snapshot-source.js';

test('falls back to sample when no file', () => {
  const r = readSnapshot(join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json'));
  expect(r.source).toBe('sample');
  expect(r.snapshot.model).toBe(sampleSnapshot.model);
});

test('reads a live snapshot and fills gaps from sample', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, JSON.stringify({ model: 'Haiku', ctxTokens: 999 }));
  const r = readSnapshot(p);
  expect(r.source).toBe('live');
  expect(r.snapshot.model).toBe('Haiku');
  expect(r.snapshot.ctxTokens).toBe(999);
  expect(typeof r.snapshot.now).toBe('number'); // filled from sample
});

test('a wrong-typed live field is ignored, keeping the sample value', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, JSON.stringify({ model: 'Haiku', ctxPct: 'oops', cost: 1.25 }));
  const r = readSnapshot(p);
  expect(r.source).toBe('live');
  expect(r.snapshot.model).toBe('Haiku'); // valid string kept
  expect(r.snapshot.ctxPct).toBe(sampleSnapshot.ctxPct); // bad number ignored
  expect(r.snapshot.cost).toBe(1.25); // valid nullable number kept
});

test('bad JSON falls back to sample, no throw', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, '{bad');
  expect(readSnapshot(p).source).toBe('sample');
});

test('keeps the new fields and drops wrong-typed ones', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(p, JSON.stringify({ sessionId: 'x', gitSha: 'y', outputStyle: 'z', ctxWindow: 5 }));
  const r = readSnapshot(p);
  expect(r.snapshot.sessionId).toBe('x');
  expect(r.snapshot.gitSha).toBe('y');
  expect(r.snapshot.outputStyle).toBe('z');
  expect(r.snapshot.ctxWindow).toBe(5);

  const q = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json');
  writeFileSync(q, JSON.stringify({ sessionId: 7, ctxWindow: 'big', outputStyle: 3 }));
  const bad = readSnapshot(q).snapshot;
  expect(bad.sessionId).toBe(sampleSnapshot.sessionId);
  expect(bad.ctxWindow).toBe(sampleSnapshot.ctxWindow);
  expect(bad.outputStyle).toBe(sampleSnapshot.outputStyle);
});
