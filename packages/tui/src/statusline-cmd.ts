import { render, toAnsi } from '@ccstatus/core';
import type { Config, Snapshot } from '@ccstatus/core';

import { configPath, loadConfigFile, snapshotPath } from './config-store.js';
import { readSnapshot } from './snapshot-source.js';

type Env = Record<string, string | undefined>;

/**
 * Renders the status-line surface to an ANSI string for the native status line.
 * @param config   - The ccstatus config.
 * @param snapshot - The snapshot to render.
 * @returns        The ANSI string, or an empty string when the surface is disabled.
 */
export function renderStatuslineAnsi(config: Config, snapshot: Snapshot): string {
  if (!config.surfaces.statusline.enabled) {
    return '';
  }
  const width = snapshot.terminalWidth || 200;
  return toAnsi(render(config, snapshot, { surface: 'statusline', width }));
}

/**
 * Reads the shared config and live snapshot and writes the status line to stdout.
 * Prints nothing when the surface is disabled or no live snapshot exists. Always
 * resolves — a status-line command must never error the host.
 * @param env - Environment used to resolve the config/snapshot paths.
 * @returns   A promise that resolves once output has been written.
 */
export async function runStatusline(env: Env = process.env): Promise<void> {
  try {
    const { config } = loadConfigFile(configPath(env));
    const snap = readSnapshot(snapshotPath(env));
    // No live snapshot (mod not running) → print nothing rather than sample data.
    if (snap.source !== 'live') {
      return;
    }
    const line = renderStatuslineAnsi(config, snap.snapshot);
    if (line) {
      process.stdout.write(line);
    }
  } catch {
    /* never error the host */
  }
}
