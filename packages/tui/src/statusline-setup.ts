import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

type Env = Record<string, string | undefined>;

export type SettingsScope = 'user' | 'project';
export type StatuslineState = 'ours' | 'absent' | 'other' | 'unknown';
export interface StatuslineInfo {
  state: StatuslineState;
  command?: string;
}
export interface SettingsIo {
  read(path: string): string | null;
  write(path: string, data: string): void;
}
export interface EnableResult {
  ok: boolean;
  message: string;
}

export const STATUSLINE_COMMAND = 'npx ccstatus statusline';

/**
 * Resolves the settings.json path for the given scope.
 * @param scope - 'user' (~/.claude) or 'project' (<cwd>/.claude).
 * @param env   - Environment used to resolve HOME.
 * @returns     The absolute settings.json path.
 */
export function settingsPath(scope: SettingsScope, env: Env = process.env): string {
  if (scope === 'project') {
    return `${process.cwd()}/.claude/settings.json`;
  }
  return `${env['HOME'] ?? ''}/.claude/settings.json`;
}

// Default IO: atomic temp+rename with a .bak, mirroring saveConfigFile's discipline.
const nodeIo: SettingsIo = {
  read: (path) => {
    try {
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    } catch {
      return null;
    }
  },
  write: (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      try {
        copyFileSync(path, path + '.bak');
      } catch {
        /* best effort */
      }
    }
    const tmp = path + '.tmp';
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  },
};

/**
 * Whether a statusLine value is the ccstatus one.
 * @param sl - The raw `statusLine` value from settings.json.
 * @returns  True when its command invokes `ccstatus statusline`.
 */
const isOurs = (sl: unknown): boolean => {
  if (!sl || typeof sl !== 'object') {
    return false;
  }
  const c = (sl as { command?: unknown }).command;
  return (
    typeof c === 'string' && (c === STATUSLINE_COMMAND || /(^|\/)ccstatus statusline$/.test(c))
  );
};

/**
 * Detects whether the chosen settings.json has our status line, another one,
 * none, or is unreadable.
 * @param scope - Which settings file to inspect.
 * @param io    - Injectable IO (defaults to node fs).
 * @param env   - Environment used to resolve the path.
 * @returns     The detected status-line state (plus the other command when present).
 */
export function detectStatusline(
  scope: SettingsScope,
  io: SettingsIo = nodeIo,
  env: Env = process.env
): StatuslineInfo {
  const text = io.read(settingsPath(scope, env));
  if (text === null) {
    return { state: 'absent' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: 'unknown' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { state: 'unknown' };
  }
  const sl = (parsed as { statusLine?: unknown }).statusLine;
  if (sl === undefined) {
    return { state: 'absent' };
  }
  if (isOurs(sl)) {
    return { state: 'ours' };
  }
  const command = (sl as { command?: unknown } | null)?.command;
  return { state: 'other', command: typeof command === 'string' ? command : undefined };
}

/**
 * Writes our statusLine block into the chosen settings.json, merging with the
 * existing content and refusing to overwrite a different statusLine unless asked.
 * @param scope                - Which settings file to write.
 * @param opts                 - Options object.
 * @param opts.replaceExisting - Overwrite a different statusLine when true.
 * @param io                   - Injectable IO (defaults to node fs with atomic write + .bak).
 * @param env                  - Environment used to resolve the path.
 * @returns                    Whether it was written, with a user-facing message.
 */
export function enableStatusline(
  scope: SettingsScope,
  opts: { replaceExisting?: boolean } = {},
  io: SettingsIo = nodeIo,
  env: Env = process.env
): EnableResult {
  const path = settingsPath(scope, env);
  const text = io.read(path);
  let settings: Record<string, unknown> = {};
  if (text !== null) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, message: 'settings.json is not a JSON object; left unchanged' };
      }
      settings = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: 'settings.json is not valid JSON; left unchanged' };
    }
  }
  const existing = settings['statusLine'];
  if (existing !== undefined && !isOurs(existing) && !opts.replaceExisting) {
    return { ok: false, message: 'a different statusLine is configured' };
  }
  settings['statusLine'] = { type: 'command', command: STATUSLINE_COMMAND, padding: 0 };
  io.write(path, JSON.stringify(settings, null, 2) + '\n');
  return { ok: true, message: `status line enabled in ${path}` };
}

/**
 * Removes our statusLine block from the chosen settings.json (only when it is ours).
 * @param scope - Which settings file to write.
 * @param io    - Injectable IO (defaults to node fs).
 * @param env   - Environment used to resolve the path.
 * @returns     Whether anything changed, with a user-facing message.
 */
export function disableStatusline(
  scope: SettingsScope,
  io: SettingsIo = nodeIo,
  env: Env = process.env
): EnableResult {
  const path = settingsPath(scope, env);
  const text = io.read(path);
  if (text === null) {
    return { ok: true, message: 'no settings.json; nothing to disable' };
  }
  let settings: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'settings.json is not a JSON object; left unchanged' };
    }
    settings = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'settings.json is not valid JSON; left unchanged' };
  }
  if (!isOurs(settings['statusLine'])) {
    return { ok: false, message: 'the configured statusLine is not ccstatus; left unchanged' };
  }
  delete settings['statusLine'];
  io.write(path, JSON.stringify(settings, null, 2) + '\n');
  return { ok: true, message: `status line disabled in ${path}` };
}
