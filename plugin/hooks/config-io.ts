import { loadConfig } from './core.js';
import type { Config } from './core.js';

/**
 * Resolve the absolute path to the shared config file from the environment.
 * @param env - The process environment, read for `XDG_CONFIG_HOME` and `HOME`.
 * @returns   The absolute path to `config.json`.
 */
export function configPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME'];
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`;
  return `${base}/ccstatus/config.json`;
}

/**
 * Resolve the absolute path to the shared snapshot file from the environment.
 * @param env - The process environment, read for `XDG_CONFIG_HOME` and `HOME`.
 * @returns   The absolute path to `snapshot.json`.
 */
export function snapshotPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME'];
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`;
  return `${base}/ccstatus/snapshot.json`;
}

/**
 * Parse config file text into a validated config, never throwing.
 * @param text - The raw config file contents, or `null` when the file is absent.
 * @returns    The loaded config and any warnings raised while validating it.
 */
export function parseConfig(text: string | null): { config: Config; warnings: string[] } {
  if (text === null) {
    return loadConfig(undefined);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const fallback = loadConfig(undefined);
    return { config: fallback.config, warnings: ['config file is not valid JSON; using defaults'] };
  }
  return loadConfig(parsed);
}

/**
 * Decide whether the config should be reloaded given its last-seen mtime.
 * @param prevMtime    - The previously observed modification time, or `null` when never read.
 * @param stat         - The current file stat.
 * @param stat.mtimeMs - The current modification time in milliseconds.
 * @returns            `true` when the config has not been read before or has changed since.
 */
export function shouldReload(prevMtime: number | null, stat: { mtimeMs: number }): boolean {
  return prevMtime === null || stat.mtimeMs !== prevMtime;
}
