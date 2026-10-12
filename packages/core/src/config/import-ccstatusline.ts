import { defaultConfig } from './defaults.js';
import type { Config, DataWidgetType, Item } from './types.js';
import { loadConfig } from './validate.js';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Every mapped target is a data widget, so a mapped item is always a DataItem.
const TYPE_MAP: Record<string, DataWidgetType> = {
  model: 'model',
  version: 'version',
  'thinking-effort': 'thinking-effort',
  'context-length': 'context-length',
  'context-percentage': 'context-percentage',
  'context-window': 'context-window',
  'context-bar': 'context-bar',
  'tokens-input': 'tokens-input',
  'tokens-output': 'tokens-output',
  'tokens-cached': 'tokens-cached',
  'tokens-total': 'tokens-total',
  'git-root-dir': 'git-root-dir',
  'git-branch': 'git-branch',
  'git-worktree': 'git-worktree',
  'git-changes': 'git-changes',
  'git-insertions': 'git-insertions',
  'git-deletions': 'git-deletions',
  'git-sha': 'git-sha',
  'session-clock': 'session-clock',
  'session-id': 'session-id',
  'current-working-dir': 'cwd',
  cwd: 'cwd',
  'session-cost': 'cost',
  cost: 'cost',
  'session-cost-rate': 'session-cost-rate',
  'session-usage': 'session-usage',
  'weekly-usage': 'weekly-usage',
  'reset-timer': 'reset-timer',
  'weekly-reset-timer': 'weekly-reset-timer',
  'block-timer': 'block-timer',
  'terminal-width': 'terminal-width',
  'output-style': 'output-style',
};

// Unsupported in the mod's data model — dropped with a specific reason. See DEC-0015.
const UNSUPPORTED: Record<string, string> = {
  'weekly-sonnet-usage': 'needs the Anthropic usage API, not available to the mod',
  'weekly-opus-usage': 'needs the Anthropic usage API, not available to the mod',
  'fable-weekly-usage': 'needs the Anthropic usage API, not available to the mod',
  'extra-usage-utilization': 'needs the Anthropic usage API, not available to the mod',
  'extra-usage-remaining': 'needs the Anthropic usage API, not available to the mod',
  'extra-usage-used': 'needs the Anthropic usage API, not available to the mod',
  'extra-usage-daily-budget': 'needs the Anthropic usage API, not available to the mod',
  'input-speed': 'needs transcript parsing, not available to the mod',
  'output-speed': 'needs transcript parsing, not available to the mod',
  'total-speed': 'needs transcript parsing, not available to the mod',
  'cache-hit-rate': 'needs transcript parsing, not available to the mod',
  'cache-read': 'needs transcript parsing, not available to the mod',
  'cache-write': 'needs transcript parsing, not available to the mod',
  'compaction-counter': 'needs transcript parsing, not available to the mod',
  skills: 'needs transcript parsing, not available to the mod',
  'session-name': 'needs transcript parsing, not available to the mod',
  'cache-timer': 'needs cache-TTL tracking, not available to the mod',
  'free-memory': 'reads OS memory, not available to the mod',
  'claude-status': 'needs a network status fetch, not available to the mod',
  'claude-account-email': 'needs local Claude config access, not available to the mod',
  'claude-session-id': 'renamed; use the session-id widget',
  'vim-mode': 'engine state not exposed to the mod',
  'voice-status': 'engine state not exposed to the mod',
  'sandbox-status': 'engine state not exposed to the mod',
  'remote-control-status': 'engine state not exposed to the mod',
  'worktree-mode': "needs Claude Code's worktree object; use the git-worktree widget",
  'worktree-name': "needs Claude Code's worktree object; use the git-worktree widget",
  'worktree-branch': "needs Claude Code's worktree object; use the git-worktree widget",
  'worktree-original-branch': "needs Claude Code's worktree object; use the git-worktree widget",
  'context-percentage-usable': 'needs usable-window data, not available to the mod',
  'context-window-size': 'renamed; use the context-window widget',
  'git-staged-files': 'needs a deeper git probe, not available to the mod',
  'git-unstaged-files': 'needs a deeper git probe, not available to the mod',
  'git-untracked-files': 'needs a deeper git probe, not available to the mod',
  'git-clean-status': 'needs a deeper git probe, not available to the mod',
  'git-status': 'needs a deeper git probe, not available to the mod',
  'git-staged': 'needs a deeper git probe, not available to the mod',
  'git-unstaged': 'needs a deeper git probe, not available to the mod',
  'git-untracked': 'needs a deeper git probe, not available to the mod',
  'git-ahead-behind': 'needs a deeper git probe, not available to the mod',
  'git-conflicts': 'needs a deeper git probe, not available to the mod',
  'git-origin-owner': 'needs a deeper git probe, not available to the mod',
  'git-origin-repo': 'needs a deeper git probe, not available to the mod',
  'git-origin-owner-repo': 'needs a deeper git probe, not available to the mod',
  'git-upstream-owner': 'needs a deeper git probe, not available to the mod',
  'git-upstream-repo': 'needs a deeper git probe, not available to the mod',
  'git-upstream-owner-repo': 'needs a deeper git probe, not available to the mod',
  'git-is-fork': 'needs a deeper git probe, not available to the mod',
  'git-review': 'needs the gh/glab CLI, not available to the mod',
  'git-ci-status': 'needs the gh/glab CLI, not available to the mod',
  link: 'OSC8 links are not yet supported',
};

/**
 * Extracts the styling fields shared by every ccstatusline item that ccstatus can carry.
 * @param raw        - The raw ccstatusline item.
 * @param idFallback - The id prefix used when the item carries no id of its own.
 * @returns          The id plus raw-value and merge flags.
 */
function baseStyle(
  raw: Record<string, unknown>,
  idFallback: string
): { id: string; rawValue?: true; merge?: true } {
  return {
    id: String(raw['id'] ?? `${idFallback}-${Math.random().toString(36).slice(2)}`),
    rawValue: raw['rawValue'] === true || undefined,
    merge: raw['merge'] === true || undefined,
  };
}

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
      switch (srcType) {
        case 'custom-text':
        case 'custom-symbol':
        case 'custom-command': {
          const field =
            srcType === 'custom-text'
              ? 'customText'
              : srcType === 'custom-symbol'
                ? 'customSymbol'
                : 'commandPath';
          const payload = raw[field];
          if (payload === undefined || payload === null || String(payload) === '') {
            warnings.push(`dropped "${srcType}" — no ${field} value`);
            return [];
          }
          return [
            srcType === 'custom-command'
              ? { ...baseStyle(raw, srcType), type: 'custom-command', command: String(payload) }
              : { ...baseStyle(raw, srcType), type: 'custom-text', text: String(payload) },
          ];
        }
        case 'flex-separator':
          return [{ id: baseStyle(raw, srcType).id, type: 'flex-separator' }];
        case 'separator':
          warnings.push(
            'dropped "separator" — ccstatus uses a global separator (set it on the Powerline screen)'
          );
          return [];
        default:
      }
      const type = Object.hasOwn(TYPE_MAP, srcType) ? TYPE_MAP[srcType] : undefined;
      if (type) {
        return [{ ...baseStyle(raw, type), type }];
      }
      if (Object.hasOwn(UNSUPPORTED, srcType)) {
        warnings.push(`dropped "${srcType}" — ${UNSUPPORTED[srcType]}`);
        return [];
      }
      warnings.push(`dropped unmapped ccstatusline item "${srcType}"`);
      return [];
    })
  );
  const draft = { version: 1, surfaces: { band: { enabled: true, lines } } };
  const loaded = loadConfig(draft);
  return { config: loaded.config, warnings: [...warnings, ...loaded.warnings] };
}
