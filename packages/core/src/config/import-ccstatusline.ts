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
  'weekly-sonnet-usage': 'the Anthropic usage API',
  'weekly-opus-usage': 'the Anthropic usage API',
  'fable-weekly-usage': 'the Anthropic usage API',
  'extra-usage-utilization': 'the Anthropic usage API',
  'extra-usage-remaining': 'the Anthropic usage API',
  'extra-usage-used': 'the Anthropic usage API',
  'extra-usage-daily-budget': 'the Anthropic usage API',
  'input-speed': 'transcript parsing',
  'output-speed': 'transcript parsing',
  'total-speed': 'transcript parsing',
  'cache-hit-rate': 'transcript parsing',
  'cache-read': 'transcript parsing',
  'cache-write': 'transcript parsing',
  'compaction-counter': 'transcript parsing',
  skills: 'transcript parsing',
  'session-name': 'transcript parsing',
  'cache-timer': 'cache-TTL tracking not available to the mod',
  'free-memory': 'OS access not available to the mod',
  'claude-status': 'a network status fetch',
  'claude-account-email': 'local Claude config access',
  'claude-session-id': 'use session-id',
  'vim-mode': 'engine state not exposed to the mod',
  'voice-status': 'engine state not exposed to the mod',
  'sandbox-status': 'engine state not exposed to the mod',
  'remote-control-status': 'engine state not exposed to the mod',
  'worktree-mode': "Claude Code's worktree object (use git-worktree)",
  'worktree-name': "Claude Code's worktree object (use git-worktree)",
  'worktree-branch': "Claude Code's worktree object (use git-worktree)",
  'worktree-original-branch': "Claude Code's worktree object (use git-worktree)",
  'context-percentage-usable': 'usable-window data not available to the mod',
  'context-window-size': 'use context-window',
  'git-staged-files': 'a deeper git probe',
  'git-unstaged-files': 'a deeper git probe',
  'git-untracked-files': 'a deeper git probe',
  'git-clean-status': 'a deeper git probe',
  'git-status': 'a deeper git probe',
  'git-staged': 'a deeper git probe',
  'git-unstaged': 'a deeper git probe',
  'git-untracked': 'a deeper git probe',
  'git-ahead-behind': 'a deeper git probe',
  'git-conflicts': 'a deeper git probe',
  'git-origin-owner': 'a deeper git probe',
  'git-origin-repo': 'a deeper git probe',
  'git-origin-owner-repo': 'a deeper git probe',
  'git-upstream-owner': 'a deeper git probe',
  'git-upstream-repo': 'a deeper git probe',
  'git-upstream-owner-repo': 'a deeper git probe',
  'git-is-fork': 'a deeper git probe',
  'git-review': 'the gh/glab CLI',
  'git-ci-status': 'the gh/glab CLI',
  link: 'OSC8 links not yet supported',
};

/**
 * Extracts the styling fields shared by every ccstatusline item that ccstatus can style.
 * @param raw        - The raw ccstatusline item.
 * @param idFallback - The id prefix used when the item carries no id of its own.
 * @returns          The id plus background, raw-value and merge flags.
 */
function baseStyle(
  raw: Record<string, unknown>,
  idFallback: string
): { id: string; bg?: string; rawValue?: true; merge?: true } {
  return {
    id: String(raw['id'] ?? `${idFallback}-${Math.random().toString(36).slice(2)}`),
    bg: typeof raw['backgroundColor'] === 'string' ? raw['backgroundColor'] : undefined,
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
          return [
            {
              ...baseStyle(raw, srcType),
              type: 'custom-text',
              text: String(raw['customText'] ?? ''),
            },
          ];
        case 'custom-symbol':
          return [
            {
              ...baseStyle(raw, srcType),
              type: 'custom-text',
              text: String(raw['customSymbol'] ?? ''),
            },
          ];
        case 'custom-command':
          return [
            {
              ...baseStyle(raw, srcType),
              type: 'custom-command',
              command: String(raw['commandPath'] ?? ''),
            },
          ];
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
        warnings.push(
          `dropped "${srcType}" — needs ${UNSUPPORTED[srcType]}, not available to the mod`
        );
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
