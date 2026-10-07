import { loadConfig, render, toAnsi } from '@ccstatus/core';
import { describe, expect, it } from 'vitest';

import { sampleSnapshot } from './sample-snapshot.js';
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
});
