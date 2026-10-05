import { existsSync, readFileSync, statSync } from 'node:fs';

import type { Snapshot } from '@ccstatus/core';

import { sampleSnapshot } from './sample-snapshot.js';

// Field categories mirror the Snapshot contract. The snapshot file is machine-
// written, but a partially-corrupt one (e.g. ctxPct as a string) must not flow
// into the renderer, so only correctly-typed fields are taken from it.
const NUMBER_FIELDS = [
  'added',
  'modified',
  'deleted',
  'ctxTokens',
  'ctxPct',
  'cached',
  'input',
  'output',
  'total',
  'startedAt',
  'terminalWidth',
  'now',
] as const;
const NULLABLE_NUMBER_FIELDS = ['cost', 'fivePct', 'weekPct'] as const;
const STRING_FIELDS = ['version', 'model', 'cwd', 'gitRoot', 'gitBranch', 'gitWorktree'] as const;
const NULLABLE_STRING_FIELDS = ['effort', 'fiveReset', 'weekReset', 'blockReset'] as const;
const BOOLEAN_FIELDS = ['repo'] as const;

const isNum = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/**
 * Extracts only the correctly-typed snapshot fields from a parsed JSON object.
 * @param parsed - The raw object parsed from the snapshot file.
 * @returns      A partial snapshot containing only well-typed fields.
 */
function sanitize(parsed: Record<string, unknown>): Partial<Snapshot> {
  const out: Record<string, unknown> = {};
  const take = (keys: readonly string[], ok: (v: unknown) => boolean): void => {
    for (const k of keys) {
      if (k in parsed && ok(parsed[k])) {
        out[k] = parsed[k];
      }
    }
  };
  take(NUMBER_FIELDS, isNum);
  take(NULLABLE_NUMBER_FIELDS, (v) => v === null || isNum(v));
  take(STRING_FIELDS, (v) => typeof v === 'string');
  take(NULLABLE_STRING_FIELDS, (v) => v === null || typeof v === 'string');
  take(BOOLEAN_FIELDS, (v) => typeof v === 'boolean');
  return out as Partial<Snapshot>;
}

/**
 * Reads the live snapshot at the given path, falling back to the bundled sample.
 * @param path - Absolute path to the snapshot JSON file.
 * @returns    The snapshot, its source ('live' or 'sample'), and the file mtime when live.
 */
export function readSnapshot(path: string): {
  snapshot: Snapshot;
  source: 'live' | 'sample';
  mtimeMs?: number;
} {
  try {
    if (!existsSync(path)) {
      return { snapshot: sampleSnapshot, source: 'sample' };
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return { snapshot: sampleSnapshot, source: 'sample' };
    }
    return {
      snapshot: { ...sampleSnapshot, ...sanitize(parsed as Record<string, unknown>) },
      source: 'live',
      mtimeMs: statSync(path).mtimeMs,
    };
  } catch {
    return { snapshot: sampleSnapshot, source: 'sample' };
  }
}
