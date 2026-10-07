import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, render, toAnsi } from '@ccstatus/core';
import { describe, expect, it } from 'vitest';

import { configPath, loadConfigFile, snapshotPath } from './config-store.js';
import { sampleSnapshot } from './sample-snapshot.js';
import { readSnapshot } from './snapshot-source.js';
import { renderStatuslineAnsi, runStatusline } from './statusline-cmd.js';

describe('renderStatuslineAnsi', () => {
  it('delegates to render+toAnsi for the statusline surface when enabled', () => {
    const { config } = loadConfig(undefined);
    config.surfaces.statusline.enabled = true;
    const snap = { ...sampleSnapshot, terminalWidth: 120 };
    const expected = toAnsi(render(config, snap, { surface: 'statusline', width: 120 }));
    expect(renderStatuslineAnsi(config, snap)).toBe(expected);
  });

  it('returns an empty string when the statusline surface is disabled', () => {
    const { config } = loadConfig(undefined);
    config.surfaces.statusline.enabled = false;
    expect(renderStatuslineAnsi(config, sampleSnapshot)).toBe('');
  });
});

describe('runStatusline', () => {
  it('writes nothing when there is no live snapshot', async () => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string): boolean => (chunks.push(String(s)), true);
    try {
      // HOME points at a nonexistent dir → no config.json / snapshot.json → sample source.
      await runStatusline({ HOME: '/nonexistent-ccstatus-test-home' });
    } finally {
      process.stdout.write = orig;
    }
    expect(chunks.join('')).toBe('');
  });

  it('writes the live, enabled status line as ANSI to stdout', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ccstatus-cmd-'));
    try {
      const cfgDir = join(dir, '.config', 'ccstatus');
      mkdirSync(cfgDir, { recursive: true });
      const { config } = loadConfig(undefined);
      config.surfaces.statusline.enabled = true;
      // Reuse the populated default band items so the statusline renders content.
      config.surfaces.statusline.lines = config.surfaces.band.lines;
      writeFileSync(join(cfgDir, 'config.json'), JSON.stringify(config));
      const liveSnap = { ...sampleSnapshot, model: 'test-model-xyz', terminalWidth: 120 };
      writeFileSync(join(cfgDir, 'snapshot.json'), JSON.stringify(liveSnap));

      // Expected = the same load path runStatusline uses (catches wrong-path / sample-vs-live).
      const env = { HOME: dir, XDG_CONFIG_HOME: '' };
      const loadedSnap = readSnapshot(snapshotPath(env));
      expect(loadedSnap.source).toBe('live');
      const expected = renderStatuslineAnsi(
        loadConfigFile(configPath(env)).config,
        loadedSnap.snapshot
      );
      expect(expected.length).toBeGreaterThan(0);

      const chunks: string[] = [];
      const orig = process.stdout.write.bind(process.stdout);
      process.stdout.write = (s: string): boolean => (chunks.push(String(s)), true);
      try {
        await runStatusline(env);
      } finally {
        process.stdout.write = orig;
      }
      expect(chunks.join('')).toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
