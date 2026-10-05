import { isColor } from '../colors.js'
import { WIDGET_TYPES } from './types.js'
import type { Align, Config, DataWidgetType, Item, ItemStyle, WidgetType } from './types.js'
import { defaultConfig } from './defaults.js'
import { configSchema } from './schema.js'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const WIDGET_TYPE_SET = new Set<WidgetType>(WIDGET_TYPES)

type RawItem = {
  id: string; type: string
  fg?: string; bg?: string; merge?: boolean; align?: Align; rawValue?: boolean
  text?: string; command?: string; metadata?: Record<string, unknown>
}

// Carry the common styling fields, dropping (and warning on) unknown colors.
function cleanStyle(raw: RawItem, type: string, warn: (s: string) => void): ItemStyle {
  const style: ItemStyle = {}
  if (raw.merge !== undefined) style.merge = raw.merge
  if (raw.align !== undefined) style.align = raw.align
  if (raw.rawValue !== undefined) style.rawValue = raw.rawValue
  for (const key of ['fg', 'bg'] as const) {
    const v = raw[key]
    if (v === undefined) continue
    if (isColor(v)) style[key] = v
    else warn(`stripped unknown color "${v}" on a ${type} item`)
  }
  return style
}

const legacy = (raw: RawItem, key: 'text' | 'command'): string | undefined => {
  const v = raw.metadata?.[key]
  return typeof v === 'string' ? v : undefined
}

// Smart constructor: turn a parsed row into a well-typed Item, or drop it.
// Legacy configs stored custom text/command under `metadata`; migrate them forward.
function cleanItem(raw: RawItem, warn: (s: string) => void): Item | null {
  const type = raw.type
  if (!WIDGET_TYPE_SET.has(type as WidgetType)) {
    warn(`dropped item with unknown type "${type}"`)
    return null
  }
  const id = raw.id
  if (type === 'flex-separator') return { id, type: 'flex-separator' }
  const style = cleanStyle(raw, type, warn)
  if (type === 'custom-text') return { id, type: 'custom-text', text: raw.text ?? legacy(raw, 'text') ?? '', ...style }
  if (type === 'custom-command') return { id, type: 'custom-command', command: raw.command ?? legacy(raw, 'command') ?? '', ...style }
  return { id, type: type as DataWidgetType, ...style }
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

  // Note a version other than 1. There is only one schema version today, so the
  // config is simply loaded as v1 (unknown fields dropped, defaults filled) rather
  // than transformed — say exactly that instead of claiming a migration.
  const rawVersion = typeof raw === 'object' && raw !== null && 'version' in raw ? (raw as { version: unknown }).version : undefined
  if (rawVersion !== undefined && rawVersion !== 1) {
    warn(`config was written for version ${rawVersion}; loaded as version 1`)
  }

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    if (raw !== undefined) warn(`config invalid (${parsed.error.issues[0]?.message ?? 'unknown'}); using defaults`)
    return { config: clone(defaultConfig), warnings }
  }
  const p = parsed.data

  const surf = (name: 'band' | 'statusline' | 'pane') => {
    const s = p.surfaces[name]
    if (!s) return clone(defaultConfig.surfaces[name])
    return {
      enabled: s.enabled,
      lines: s.lines.map(line => line.map(it => cleanItem(it, warn)).filter((x): x is Item => x !== null)),
    }
  }

  const themesToUse = Object.keys(p.themes).length ? p.themes : clone(defaultConfig.themes)

  const config: Config = {
    version: 1,
    theme: p.theme,
    themes: cleanThemes(themesToUse, warn),
    defaults: { ...defaultConfig.defaults, ...p.defaults },
    surfaces: {
      band: surf('band'),
      statusline: surf('statusline'),
      pane: surf('pane'),
      toasts: p.surfaces.toasts ?? clone(defaultConfig.surfaces.toasts),
    },
  }
  return { config, warnings }
}
