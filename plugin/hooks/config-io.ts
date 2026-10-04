import { loadConfig } from './core.js'
import type { Config } from './core.js'

export function configPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME']
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`
  return `${base}/ccstatus/config.json`
}

export function snapshotPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME']
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`
  return `${base}/ccstatus/snapshot.json`
}

export function parseConfig(text: string | null): { config: Config; warnings: string[] } {
  if (text === null) return loadConfig(undefined)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const fallback = loadConfig(undefined)
    return { config: fallback.config, warnings: ['config file is not valid JSON; using defaults'] }
  }
  return loadConfig(parsed)
}

export function shouldReload(prevMtime: number | null, stat: { mtimeMs: number }): boolean {
  return prevMtime === null || stat.mtimeMs !== prevMtime
}
