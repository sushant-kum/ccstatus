import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadConfig } from '@ccstatus/core'
import type { Config } from '@ccstatus/core'

type Env = Record<string, string | undefined>
const base = (env: Env) => {
  const xdg = env['XDG_CONFIG_HOME']
  return xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`
}
export const configPath = (env: Env = process.env) => `${base(env)}/ccstatus/config.json`
export const snapshotPath = (env: Env = process.env) => `${base(env)}/ccstatus/snapshot.json`

export function loadConfigFile(path: string): { config: Config; warnings: string[] } {
  let text: string | null = null
  if (existsSync(path)) {
    // Distinguish "file exists but can't be read" (EACCES/EISDIR/transient I/O) from
    // "no config yet". Collapsing both to defaults would hide a recoverable config —
    // and a later save would overwrite it with defaults, with no warning and no .bak.
    try { text = readFileSync(path, 'utf8') }
    catch (e) {
      const f = loadConfig(undefined)
      return { config: f.config, warnings: [`could not read config file (${e instanceof Error ? e.message : String(e)}); editing from defaults — saving will replace it`] }
    }
  }
  if (text === null) return loadConfig(undefined)
  try { return loadConfig(JSON.parse(text)) }
  catch { const f = loadConfig(undefined); return { config: f.config, warnings: ['config file is not valid JSON; using defaults'] } }
}

// Returns any warnings from the re-validation round-trip so the caller can tell
// the user which fields were dropped/normalized on write (empty = clean save).
export function saveConfigFile(path: string, config: Config): string[] {
  const { config: clean, warnings } = loadConfig(config) // only ever write valid config
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) { try { copyFileSync(path, path + '.bak') } catch { /* best effort */ } }
  const tmp = path + '.tmp'
  writeFileSync(tmp, JSON.stringify(clean, null, 2))
  renameSync(tmp, path)
  return warnings
}
