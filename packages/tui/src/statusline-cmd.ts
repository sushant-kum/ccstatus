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
 * resolves — a status-line command must never error the host. When `CCSTATUS_DEBUG`
 * is set, config warnings and a swallowed error are written to stderr (which the
 * host ignores), so running the command by hand still yields a signal.
 * @param env - Environment used to resolve the config/snapshot paths.
 * @returns   A promise that resolves once output has been written.
 */
export async function runStatusline(env: Env = process.env): Promise<void> {
  const debug = Boolean(env['CCSTATUS_DEBUG']);
  try {
    const { config, warnings } = loadConfigFile(configPath(env));
    if (debug && warnings.length) {
      process.stderr.write(`ccstatus statusline: ${warnings.join('; ')}\n`);
    }
    const snap = readSnapshot(snapshotPath(env));
    // No live snapshot (mod not running) → print nothing rather than sample data.
    if (snap.source !== 'live') {
      if (debug) {
        process.stderr.write('ccstatus statusline: no live snapshot (is the mod running?)\n');
      }
      return;
    }
    const line = renderStatuslineAnsi(config, snap.snapshot);
    if (line) {
      process.stdout.write(line);
    }
  } catch (e) {
    // Never error the host: swallow and exit 0. The host reads the status from
    // stdout, so surfacing the cause on stderr is safe — but only under the flag.
    if (debug) {
      process.stderr.write(`ccstatus statusline: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
}
