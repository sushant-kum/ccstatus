import { isColor } from '../colors.js';
import { isValidWhen } from '../toast.js';

import { defaultConfig } from './defaults.js';
import { configSchema } from './schema.js';
import { WIDGET_TYPES } from './types.js';
import type {
  Align,
  Config,
  DataWidgetType,
  Item,
  ItemStyle,
  SurfaceLayout,
  ToastSurface,
  WidgetType,
} from './types.js';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const WIDGET_TYPE_SET = new Set<WidgetType>(WIDGET_TYPES);

interface RawItem {
  id: string;
  type: string;
  fg?: string;
  bg?: string;
  merge?: boolean;
  align?: Align;
  rawValue?: boolean;
  text?: string;
  command?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Carries the common styling fields of a raw item, dropping and warning on unknown colors.
 * @param raw  - The parsed item row to read styling fields from.
 * @param type - The item's widget type, used in warning messages.
 * @param warn - Callback invoked with a message for each stripped field.
 * @returns    The validated styling fields for the item.
 */
function cleanStyle(raw: RawItem, type: string, warn: (s: string) => void): ItemStyle {
  const style: ItemStyle = {};
  if (raw.merge !== undefined) {
    style.merge = raw.merge;
  }
  if (raw.align !== undefined) {
    style.align = raw.align;
  }
  if (raw.rawValue !== undefined) {
    style.rawValue = raw.rawValue;
  }
  for (const key of ['fg', 'bg'] as const) {
    const v = raw[key];
    if (v === undefined) {
      continue;
    }
    if (isColor(v)) {
      style[key] = v;
    } else {
      warn(`stripped unknown color "${v}" on a ${type} item`);
    }
  }
  return style;
}

const legacy = (raw: RawItem, key: 'text' | 'command'): string | undefined => {
  const v = raw.metadata?.[key];
  return typeof v === 'string' ? v : undefined;
};

/**
 * Turns a parsed row into a well-typed item, or drops it when the type is unknown.
 *
 * This is the smart constructor for items; legacy configs stored custom text and
 * command under `metadata`, so those are migrated forward here.
 * @param raw  - The parsed item row to construct from.
 * @param warn - Callback invoked with a message when the item is dropped.
 * @returns    The constructed item, or `null` when it has an unknown type.
 */
function cleanItem(raw: RawItem, warn: (s: string) => void): Item | null {
  const type = raw.type;
  if (!WIDGET_TYPE_SET.has(type as WidgetType)) {
    warn(`dropped item with unknown type "${type}"`);
    return null;
  }
  const id = raw.id;
  if (type === 'flex-separator') {
    return { id, type: 'flex-separator' };
  }
  const style = cleanStyle(raw, type, warn);
  if (type === 'custom-text') {
    return { id, type: 'custom-text', text: raw.text ?? legacy(raw, 'text') ?? '', ...style };
  }
  if (type === 'custom-command') {
    return {
      id,
      type: 'custom-command',
      command: raw.command ?? legacy(raw, 'command') ?? '',
      ...style,
    };
  }
  return { id, type: type as DataWidgetType, ...style };
}

/**
 * Validates every color in each theme, stripping and warning on unknown colors.
 * @param themes - The themes keyed by name, each mapping widget names to color entries.
 * @param warn   - Callback invoked with a message for each stripped color.
 * @returns      The themes with only valid colors retained.
 */
function cleanThemes(
  themes: Record<string, Record<string, { fg?: string; bg?: string }>>,
  warn: (s: string) => void
): Record<string, Record<string, { fg?: string; bg?: string }>> {
  const cleaned: Record<string, Record<string, { fg?: string; bg?: string }>> = {};
  for (const [themeName, themeEntries] of Object.entries(themes)) {
    const cleanedEntries: Record<string, { fg?: string; bg?: string }> = {};
    for (const [widgetName, entry] of Object.entries(themeEntries)) {
      const cleanedEntry = { ...entry };
      for (const key of ['fg', 'bg'] as const) {
        if (cleanedEntry[key] !== undefined && !isColor(cleanedEntry[key])) {
          warn(
            `stripped unknown color "${cleanedEntry[key]}" in theme "${themeName}" (${widgetName})`
          );
          cleanedEntry[key] = undefined;
        }
      }
      cleanedEntries[widgetName] = cleanedEntry;
    }
    cleaned[themeName] = cleanedEntries;
  }
  return cleaned;
}

/**
 * Validates toast rules through the shared `isValidWhen`, dropping rules that can never fire.
 *
 * Rules go through the same validator the TUI authors with, so a hand-edited or
 * imported rule whose `when` cannot fire is dropped with a warning here rather
 * than silently loading and never firing.
 * @param raw  - The parsed toast surface, or `undefined` to fall back to defaults.
 * @param warn - Callback invoked with a message for each dropped rule.
 * @returns    The toast surface with only valid rules retained.
 */
function cleanToasts(raw: ToastSurface | undefined, warn: (s: string) => void): ToastSurface {
  if (!raw) {
    return clone(defaultConfig.surfaces.toasts);
  }
  const rules = raw.rules.filter((r) => {
    if (isValidWhen(r.when)) {
      return true;
    }
    warn(`dropped toast rule with invalid condition "${r.when}"`);
    return false;
  });
  return { enabled: raw.enabled, rules };
}

/**
 * Validates, migrates, and fills defaults for an untrusted config, never throwing.
 *
 * Invalid items, colors, and toast rules are dropped with warnings; a wholly
 * invalid config falls back to the defaults.
 * @param raw - The untrusted, parsed config value.
 * @returns   The safe, fully-populated config along with any warnings produced.
 */
export function loadConfig(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = [];
  const warn = (s: string): void => {
    warnings.push(s);
  };

  // Note a version other than 1. There is only one schema version today, so the
  // config is simply loaded as v1 (unknown fields dropped, defaults filled) rather
  // than transformed — say exactly that instead of claiming a migration.
  const rawVersion =
    typeof raw === 'object' && raw !== null && 'version' in raw
      ? (raw as { version: unknown }).version
      : undefined;
  if (rawVersion !== undefined && rawVersion !== 1) {
    warn(`config was written for version ${rawVersion}; loaded as version 1`);
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw !== undefined) {
      warn(`config invalid (${parsed.error.issues[0]?.message ?? 'unknown'}); using defaults`);
    }
    return { config: clone(defaultConfig), warnings };
  }
  const p = parsed.data;

  const surf = (name: 'band' | 'statusline' | 'pane'): SurfaceLayout => {
    const s = p.surfaces[name];
    if (!s) {
      return clone(defaultConfig.surfaces[name]);
    }
    return {
      enabled: s.enabled,
      lines: s.lines.map((line) =>
        line.map((it) => cleanItem(it, warn)).filter((x): x is Item => x !== null)
      ),
    };
  };

  const themesToUse = Object.keys(p.themes).length ? p.themes : clone(defaultConfig.themes);

  const config: Config = {
    version: 1,
    theme: p.theme,
    themes: cleanThemes(themesToUse, warn),
    defaults: { ...defaultConfig.defaults, ...p.defaults },
    surfaces: {
      band: surf('band'),
      statusline: surf('statusline'),
      pane: surf('pane'),
      toasts: cleanToasts(p.surfaces.toasts, warn),
    },
  };
  return { config, warnings };
}
