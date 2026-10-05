import { expect, test } from 'claude-code/testing';

import { configPath, parseConfig, snapshotPath } from './config-io.js';

test('configPath prefers XDG_CONFIG_HOME', () => {
  expect(configPath({ XDG_CONFIG_HOME: '/x/.config', HOME: '/home/u' })).toBe(
    '/x/.config/ccstatus/config.json'
  );
});
test('configPath falls back to HOME/.config', () => {
  expect(configPath({ HOME: '/home/u' })).toBe('/home/u/.config/ccstatus/config.json');
});
test('absent file yields default config, no warnings', () => {
  const { config, warnings } = parseConfig(null);
  expect(config.version).toBe(1);
  expect(warnings).toEqual([]);
});
test('invalid JSON yields default config with a warning', () => {
  const { config, warnings } = parseConfig('{not json');
  expect(config.version).toBe(1);
  expect(warnings.some((w) => w.includes('JSON'))).toBe(true);
});
test('valid JSON is loaded through core', () => {
  const raw = JSON.stringify({ version: 1, surfaces: { band: { enabled: false, lines: [] } } });
  const { config } = parseConfig(raw);
  expect(config.surfaces.band.enabled).toBe(false);
});

test('snapshotPath sits beside the config', () => {
  expect(snapshotPath({ HOME: '/home/u' })).toBe('/home/u/.config/ccstatus/snapshot.json');
});
