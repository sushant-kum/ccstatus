import { existsSync, readFileSync, statSync } from 'node:fs'
import type { Snapshot } from '@ccstatus/core'
import { sampleSnapshot } from './sample-snapshot.js'

export function readSnapshot(path: string): {
  snapshot: Snapshot
  source: 'live' | 'sample'
  mtimeMs?: number
} {
  try {
    if (!existsSync(path))
      return { snapshot: sampleSnapshot, source: 'sample' }
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object')
      return { snapshot: sampleSnapshot, source: 'sample' }
    return {
      snapshot: { ...sampleSnapshot, ...parsed },
      source: 'live',
      mtimeMs: statSync(path).mtimeMs,
    }
  } catch {
    return { snapshot: sampleSnapshot, source: 'sample' }
  }
}
