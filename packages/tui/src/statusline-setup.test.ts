import { describe, expect, it } from 'vitest';

import {
  detectStatusline,
  disableStatusline,
  enableStatusline,
  settingsPath,
  STATUSLINE_COMMAND,
  type SettingsIo,
  type StatuslineState,
} from './statusline-setup.js';

const env = { HOME: '/home/u' };

/**
 * Builds an in-memory SettingsIo seeded with the given file content.
 * @param initial - Initial file content, or null for a missing file.
 * @returns       The injectable io and an accessor for the current content.
 */
function fakeIo(initial: string | null): { io: SettingsIo; written: () => string | null } {
  let store = initial;
  return {
    io: { read: () => store, write: (_p, data) => void (store = data) },
    written: () => store,
  };
}

describe('enableStatusline', () => {
  it('merges into existing settings, preserving unrelated keys', () => {
    const f = fakeIo(JSON.stringify({ theme: 'dark', permissions: { allow: ['Bash'] } }));
    const r = enableStatusline('user', {}, f.io, env);
    expect(r.ok).toBe(true);
    const out = JSON.parse(f.written() as string);
    expect(out.theme).toBe('dark');
    expect(out.permissions).toEqual({ allow: ['Bash'] });
    expect(out.statusLine).toEqual({ type: 'command', command: STATUSLINE_COMMAND, padding: 0 });
  });

  it('refuses to overwrite a different statusLine unless replaceExisting is set', () => {
    const f = fakeIo(JSON.stringify({ statusLine: { type: 'command', command: 'other.sh' } }));
    const refused = enableStatusline('user', {}, f.io, env);
    expect(refused.ok).toBe(false);
    expect(JSON.parse(f.written() as string).statusLine.command).toBe('other.sh');
    const forced = enableStatusline('user', { replaceExisting: true }, f.io, env);
    expect(forced.ok).toBe(true);
    expect(JSON.parse(f.written() as string).statusLine.command).toBe(STATUSLINE_COMMAND);
  });

  it('refuses on invalid JSON without clobbering the file', () => {
    const f = fakeIo('{ not valid json');
    const r = enableStatusline('user', {}, f.io, env);
    expect(r.ok).toBe(false);
    expect(f.written()).toBe('{ not valid json');
  });
});

describe('detectStatusline', () => {
  it('classifies ours / other / absent / unknown', () => {
    expect(detectStatusline('user', fakeIo(null).io, env).state).toBe('absent');
    expect(
      detectStatusline(
        'user',
        fakeIo(JSON.stringify({ statusLine: { command: STATUSLINE_COMMAND } })).io,
        env
      ).state
    ).toBe('ours');
    const other = detectStatusline(
      'user',
      fakeIo(JSON.stringify({ statusLine: { command: 'x.sh' } })).io,
      env
    );
    expect(other.state).toBe('other');
    expect(other.command).toBe('x.sh');
    expect(detectStatusline('user', fakeIo('{bad').io, env).state).toBe('unknown');
  });
});

describe('disableStatusline', () => {
  it('removes only our statusLine and preserves other keys', () => {
    const f = fakeIo(
      JSON.stringify({
        theme: 'dark',
        statusLine: { type: 'command', command: STATUSLINE_COMMAND },
      })
    );
    expect(disableStatusline('user', f.io, env).ok).toBe(true);
    expect(JSON.parse(f.written() as string)).toEqual({ theme: 'dark' });
  });

  it('leaves a different statusLine untouched', () => {
    const raw = JSON.stringify({ statusLine: { command: 'other.sh' } });
    const f = fakeIo(raw);
    expect(disableStatusline('user', f.io, env).ok).toBe(false);
    expect(f.written()).toBe(raw);
  });
});

describe('settingsPath', () => {
  it('resolves user and project scopes', () => {
    expect(settingsPath('user', env)).toBe('/home/u/.claude/settings.json');
    expect(settingsPath('project', env)).toBe(`${process.cwd()}/.claude/settings.json`);
  });

  it('types detected states', () => {
    const s: StatuslineState = detectStatusline('user', fakeIo(null).io, env).state;
    expect(s).toBe('absent');
  });
});

describe('hardening', () => {
  it('rejects array settings in enable/disable and reports unknown in detect', () => {
    const f = fakeIo('[]');
    expect(enableStatusline('user', {}, f.io, env).ok).toBe(false);
    expect(f.written()).toBe('[]');
    expect(disableStatusline('user', f.io, env).ok).toBe(false);
    expect(detectStatusline('user', f.io, env).state).toBe('unknown');
  });

  it('reports unknown for non-object JSON', () => {
    expect(detectStatusline('user', fakeIo('"str"').io, env).state).toBe('unknown');
    expect(detectStatusline('user', fakeIo('42').io, env).state).toBe('unknown');
  });

  it('replaceExisting preserves other top-level keys', () => {
    const f = fakeIo(JSON.stringify({ theme: 'dark', statusLine: { command: 'other.sh' } }));
    expect(enableStatusline('user', { replaceExisting: true }, f.io, env).ok).toBe(true);
    const out = JSON.parse(f.written() as string);
    expect(out.theme).toBe('dark');
    expect(out.statusLine.command).toBe(STATUSLINE_COMMAND);
  });

  it('disable on a missing file is ok and writes nothing', () => {
    const f = fakeIo(null);
    expect(disableStatusline('user', f.io, env).ok).toBe(true);
    expect(f.written()).toBeNull();
  });

  it('re-enabling when already ours is idempotent', () => {
    const f = fakeIo(null);
    enableStatusline('user', {}, f.io, env);
    expect(enableStatusline('user', {}, f.io, env).ok).toBe(true);
    expect(JSON.parse(f.written() as string).statusLine.command).toBe(STATUSLINE_COMMAND);
  });

  it('does not treat a wrapper command as ours', () => {
    const f = fakeIo(
      JSON.stringify({ statusLine: { command: 'my-wrapper ccstatus statusline --x' } })
    );
    expect(detectStatusline('user', f.io, env).state).toBe('other');
  });
});
