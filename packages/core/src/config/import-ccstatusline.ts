import type { Config, Item, WidgetType } from './types.js'
import { loadConfig } from './validate.js'
import { defaultConfig } from './defaults.js'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const TYPE_MAP: Record<string, WidgetType> = {
  version: 'version', model: 'model', 'thinking-effort': 'model',
  'context-length': 'context-length', 'context-percentage': 'context-percentage',
  'tokens-cached': 'tokens-cached', 'tokens-input': 'tokens-input',
  'tokens-output': 'tokens-output', 'tokens-total': 'tokens-total',
  'git-root-dir': 'git-root-dir', 'git-branch': 'git-branch',
  'git-worktree': 'git-worktree', 'git-changes': 'git-changes',
  'session-clock': 'session-clock',
}

export function importCcstatusline(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = []
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { lines?: unknown }).lines)) {
    warnings.push('input is not a ccstatusline config; using defaults')
    return { config: clone(defaultConfig), warnings }
  }
  const lines = (raw as { lines: unknown[][] }).lines.map(line =>
    (Array.isArray(line) ? line : []).flatMap((item: unknown): Item[] => {
      const raw = item as Record<string, unknown>
      if (!item || typeof item !== 'object') { warnings.push('dropped non-object ccstatusline item'); return [] }
      const srcType = String(raw['type'])
      const type = Object.hasOwn(TYPE_MAP, srcType) ? TYPE_MAP[srcType] : undefined
      if (!type) { warnings.push(`dropped unmapped ccstatusline item "${srcType}"`); return [] }
      const mapped: Item = {
        id: String(raw['id'] ?? `${type}-${Math.random().toString(36).slice(2)}`),
        type,
        bg: typeof raw['backgroundColor'] === 'string' ? raw['backgroundColor'] : undefined,
        rawValue: raw['rawValue'] === true || undefined,
        merge: raw['merge'] === true || undefined,
      }
      return [mapped]
    }),
  )
  const draft = { version: 1, surfaces: { band: { enabled: true, lines } } }
  const loaded = loadConfig(draft)
  return { config: loaded.config, warnings: [...warnings, ...loaded.warnings] }
}
