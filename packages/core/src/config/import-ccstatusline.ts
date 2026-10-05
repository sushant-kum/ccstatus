import { defaultConfig } from './defaults.js';
import type { Config, DataWidgetType, Item } from './types.js';
import { loadConfig } from './validate.js';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Every mapped target is a data widget, so a mapped item is always a DataItem.
const TYPE_MAP: Record<string, DataWidgetType> = {
  version: 'version',
  model: 'model',
  'thinking-effort': 'model',
  'context-length': 'context-length',
  'context-percentage': 'context-percentage',
  'tokens-cached': 'tokens-cached',
  'tokens-input': 'tokens-input',
  'tokens-output': 'tokens-output',
  'tokens-total': 'tokens-total',
  'git-root-dir': 'git-root-dir',
  'git-branch': 'git-branch',
  'git-worktree': 'git-worktree',
  'git-changes': 'git-changes',
  'session-clock': 'session-clock',
};

/**
 * Converts a ccstatusline config into a ccstatus config, mapping known widgets and dropping the rest.
 * @param raw - The parsed ccstatusline config, or any value when the input is untrusted.
 * @returns   The resulting ccstatus config along with warnings for anything that could not be mapped.
 */
export function importCcstatusline(raw: unknown): { config: Config; warnings: string[] } {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { lines?: unknown }).lines)) {
    warnings.push('input is not a ccstatusline config; using defaults');
    return { config: clone(defaultConfig), warnings };
  }
  const lines = (raw as { lines: unknown[][] }).lines.map((line) =>
    (Array.isArray(line) ? line : []).flatMap((item: unknown): Item[] => {
      const raw = item as Record<string, unknown>;
      if (!item || typeof item !== 'object') {
        warnings.push('dropped non-object ccstatusline item');
        return [];
      }
      const srcType = String(raw['type']);
      const type = Object.hasOwn(TYPE_MAP, srcType) ? TYPE_MAP[srcType] : undefined;
      if (!type) {
        warnings.push(`dropped unmapped ccstatusline item "${srcType}"`);
        return [];
      }
      const mapped: Item = {
        id: String(raw['id'] ?? `${type}-${Math.random().toString(36).slice(2)}`),
        type,
        bg: typeof raw['backgroundColor'] === 'string' ? raw['backgroundColor'] : undefined,
        rawValue: raw['rawValue'] === true || undefined,
        merge: raw['merge'] === true || undefined,
      };
      return [mapped];
    })
  );
  const draft = { version: 1, surfaces: { band: { enabled: true, lines } } };
  const loaded = loadConfig(draft);
  return { config: loaded.config, warnings: [...warnings, ...loaded.warnings] };
}
