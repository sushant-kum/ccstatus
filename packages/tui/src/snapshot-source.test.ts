import { expect, test } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSnapshot } from './snapshot-source.js'
import { sampleSnapshot } from './sample-snapshot.js'

test('falls back to sample when no file', () => {
  const r = readSnapshot(join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json'))
  expect(r.source).toBe('sample')
  expect(r.snapshot.model).toBe(sampleSnapshot.model)
})

test('reads a live snapshot and fills gaps from sample', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json')
  writeFileSync(p, JSON.stringify({ model: 'Haiku', ctxTokens: 999 }))
  const r = readSnapshot(p)
  expect(r.source).toBe('live')
  expect(r.snapshot.model).toBe('Haiku')
  expect(r.snapshot.ctxTokens).toBe(999)
  expect(typeof r.snapshot.now).toBe('number') // filled from sample
})

test('bad JSON falls back to sample, no throw', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'snapshot.json')
  writeFileSync(p, '{bad')
  expect(readSnapshot(p).source).toBe('sample')
})
