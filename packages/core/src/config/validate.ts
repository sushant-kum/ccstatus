import { isColor } from '../colors.js'
import type { Config, Item, WidgetType } from './types.js'
import { defaultConfig } from './defaults.js'
import { configSchema } from './schema.js'

const WIDGET_TYPES = new Set<WidgetType>([
  'model', 'version', 'context-length', 'context-percentage',
  'tokens-input', 'tokens-output', 'tokens-cached', 'tokens-total',
  'session-clock', 'cwd',
  'git-branch', 'git-changes', 'git-worktree', 'git-root-dir',
  'cost', 'rate-limit-5h', 'rate-limit-week', 'block-timer',
  'custom-text', 'custom-command', 'flex-separator',
])

function cleanItem(raw: { type: string; fg?: string; bg?: string } & Record<string, unknown>, warn: (s: string) => void): Item | null {
  if (!WIDGET_TYPES.has(raw.type as WidgetType)) {
    warn(`dropped item with unknown type "${raw.type}"`)
    return null
  }
  const item = { ...raw, type: raw.type as WidgetType } as Item
  for (const key of ['fg', 'bg'] as const) {
    if (item[key] !== undefined && !isColor(item[key])) {
      warn(`stripped unknown color "${item[key]}" on a ${item.type} item`)
      item[key] = undefined
    }
  }
  return item
}

function cleanThemes(themes: Record<string, Record<string, { fg?: string; bg?: string }>>, warn: (s: string) => void): Record<string, Record<string, { fg?: string; bg?: string }>> {
  const cleaned: Record<string, Record<string, { fg?: string; bg?: string }>> = {}
  for (const [themeName, themeEntries] of Object.entries(themes)) {
    const cleanedEntries: Record<string, { fg?: string; bg?: string }> = {}
    for (const [widgetName, entry] of Object.entries(themeEntries)) {
      const cleanedEntry = { ...entry }
      for (const key of ['fg', 'bg'] as const) {
        if (cleanedEntry[key] !== undefined && !isColor(cleanedEntry[key])) {
          warn(`stripped unknown color "${cleanedEntry[key]}" in theme "${themeName}" (${widgetName})`)
          cleanedEntry[key] = undefined
        }
      }
      cleanedEntries[widgetName] = cleanedEntry
    }
    cleaned[themeName] = cleanedEntries
  }
  return cleaned
}

export function loadConfig(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = []
  const warn = (s: string) => warnings.push(s)

  // Check for version migration before parsing
  const rawVersion = typeof raw === 'object' && raw !== null && 'version' in raw ? (raw as { version: unknown }).version : undefined
  if (rawVersion !== undefined && rawVersion !== 1) {
    warn(`migrated config from version ${rawVersion} to 1`)
  }

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    if (raw !== undefined) warn(`config invalid (${parsed.error.issues[0]?.message ?? 'unknown'}); using defaults`)
    return { config: structuredClone(defaultConfig), warnings }
  }
  const p = parsed.data

  const surf = (name: 'band' | 'statusline' | 'pane') => {
    const s = p.surfaces[name]
    if (!s) return structuredClone(defaultConfig.surfaces[name])
    return {
      enabled: s.enabled,
      lines: s.lines.map(line => line.map(it => cleanItem(it, warn)).filter((x): x is Item => x !== null)),
    }
  }

  const themesToUse = Object.keys(p.themes).length ? p.themes : structuredClone(defaultConfig.themes)

  const config: Config = {
    version: 1,
    theme: p.theme,
    themes: cleanThemes(themesToUse, warn),
    defaults: { ...defaultConfig.defaults, ...p.defaults },
    surfaces: {
      band: surf('band'),
      statusline: surf('statusline'),
      pane: surf('pane'),
      toasts: p.surfaces.toasts ?? structuredClone(defaultConfig.surfaces.toasts),
    },
  }
  return { config, warnings }
}
