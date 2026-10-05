import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultConfig } from '@ccstatus/core';
import { expect, test } from 'vitest';

import { configPath, loadConfigFile, saveConfigFile, snapshotPath } from './config-store.js';

test('paths honor XDG then HOME', () => {
  expect(configPath({ XDG_CONFIG_HOME: '/x', HOME: '/h' })).toBe('/x/ccstatus/config.json');
  expect(configPath({ HOME: '/h' })).toBe('/h/.config/ccstatus/config.json');
  expect(snapshotPath({ HOME: '/h' })).toBe('/h/.config/ccstatus/snapshot.json');
});
test('missing file loads defaults, no throw', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'ccs-')), 'config.json');
  const { config } = loadConfigFile(p);
  expect(config.version).toBe(1);
});
test('an existing but unreadable config loads defaults WITH a warning (not silently)', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  mkdirSync(p); // a directory where a file is expected → readFileSync throws EISDIR
  const { config, warnings } = loadConfigFile(p);
  expect(config.version).toBe(1); // falls back to defaults
  expect(warnings.some((w) => /could not read/i.test(w))).toBe(true); // but is NOT silent
});
test('invalid JSON loads defaults with a warning', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  writeFileSync(p, '{not json');
  const { config, warnings } = loadConfigFile(p);
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});
test('save is atomic + backs up the prior file', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  writeFileSync(p, JSON.stringify({ old: true }));
  saveConfigFile(p, defaultConfig);
  expect(JSON.parse(readFileSync(p, 'utf8')).version).toBe(1);
  expect(existsSync(p + '.bak')).toBe(true);
  expect(JSON.parse(readFileSync(p + '.bak', 'utf8')).old).toBe(true);
});
test('save returns the warnings from re-validation', () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  const p = join(d, 'config.json');
  const dirty = {
    ...defaultConfig,
    surfaces: {
      ...defaultConfig.surfaces,
      band: { enabled: true, lines: [[{ id: 'x', type: 'model', fg: 'notacolor' }]] },
    },
  } as unknown as typeof defaultConfig;
  const warnings = saveConfigFile(p, dirty);
  expect(warnings.some((w) => w.includes('notacolor'))).toBe(true);
  // the stripped field must not reach disk
  expect(JSON.parse(readFileSync(p, 'utf8')).surfaces.band.lines[0][0].fg).toBeUndefined();
});
