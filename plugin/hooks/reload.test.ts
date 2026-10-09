/* eslint-disable @typescript-eslint/no-explicit-any -- harness boundary: `claude-code/testing` is untyped on disk ($, on, events) */
import { expect, mock, test } from 'claude-code/testing';

import { shouldReload } from './config-io.js';
import { defaultConfig } from './core.js';

test('shouldReload on first stat and on mtime change', () => {
  expect(shouldReload(null, { mtimeMs: 10 })).toBe(true);
  expect(shouldReload(10, { mtimeMs: 10 })).toBe(false);
  expect(shouldReload(10, { mtimeMs: 20 })).toBe(true);
});

interface SetupWorld {
  text: string;
  mtime: number;
  reads: number;
  writes: string[];
  baks: string[];
  snapshots: string[];
  tmp: Record<string, string>;
  clock: any;
}

/**
 * Wire up the engine mocks shared by the reload tests.
 * @param $  - The test engine interface.
 * @param on - The test hook registrar.
 * @returns  A mutable world object recording reads, writes, and snapshots.
 */
function setup($: any, on: any): SetupWorld {
  const clock = mock.clock(on, { now: 1_000_000 });
  mock.env(on, { HOME: '/h' });
  const w: SetupWorld = {
    text: JSON.stringify(defaultConfig),
    mtime: 1,
    reads: 0,
    writes: [],
    baks: [],
    snapshots: [],
    tmp: {},
    clock: null,
  };
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }));
  on('command.register', async () => ({ value: { command: 'ccstatus' } }));
  on('fs.read', async () => {
    w.reads++;
    return { value: w.text } as any;
  });
  on('fs.stat', async () => ({ value: { mtimeMs: w.mtime } }) as any);
  on('fs.write', async (_$: any, e: any) => {
    const p = String(e.path);
    if (p.endsWith('/snapshot.json')) {
      w.snapshots.push(e.text);
      return { value: undefined } as any;
    }
    if (p.endsWith('.bak')) {
      w.baks.push(e.text);
      return { value: undefined } as any;
    }
    if (p.endsWith('.tmp')) {
      w.tmp[p] = e.text;
      return { value: undefined } as any;
    }
    w.writes.push(e.text);
    w.text = e.text;
    return { value: undefined } as any;
  });
  // Simulate the atomic rename: `mv -f <tmp> <dest>` moves staged content over the
  // destination. A committed write lands in w.writes (and w.text), same as before.
  on('process.run', async (_$: any, e: any) => {
    const argv = e.argv as string[];
    const run = {
      exitCode: 0,
      stdout: '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    };
    if (argv[0] === 'mv') {
      const src = argv[2] ?? '';
      const staged = w.tmp[src];
      if (staged !== undefined) {
        w.writes.push(staged);
        w.text = staged;
        delete w.tmp[src];
      }
    }
    return { value: run } as any;
  });
  on('session.cwd', async () => ({ value: '' }));
  on('session.model', async () => ({ value: 'opus' }));
  on('session.version', async () => ({ value: { version: '1.2.3' } }));
  on(
    'session.usage',
    async () =>
      ({
        value: { context: { tokens: 1, percent: 5 }, rateLimits: [], startedAt: 0 },
      }) as any
  );
  w.clock = clock;
  return w;
}

test('tick reloads config only when the file mtime changes', async ($, on) => {
  const w = setup($, on);
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  await w.clock.advance(2100); // settle: first stat may load the config
  const settled = w.reads;
  await w.clock.advance(2100); // same mtime: no reload
  expect(w.reads).toBe(settled);
  w.mtime = 2;
  await w.clock.advance(2100);
  expect(w.reads).toBeGreaterThan(settled);
});

test('/ccstatus reload forces a re-read', async ($, on) => {
  const w = setup($, on);
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  await w.clock.advance(2100); // settle
  const before = w.reads; // mtime stays unchanged from here
  const r = await $.command.run({ command: 'ccstatus', args: 'reload' } as any);
  expect(r.text).toContain('reload');
  expect(w.reads).toBeGreaterThan(before);
});

test('/ccstatus theme <name> writes the config back atomically (temp + mv, .bak kept)', async ($, on) => {
  const w = setup($, on);
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  const name = Object.keys(defaultConfig.themes)[0] ?? '';
  const r = await $.command.run({ command: 'ccstatus', args: `theme ${name}` } as any);
  expect(w.writes).toHaveLength(1);
  expect(JSON.parse(w.writes[0] ?? '{}').theme).toBe(name);
  expect(w.baks).toHaveLength(1); // prior config is backed up to .bak before overwriting
  expect(Object.keys(w.tmp)).toHaveLength(0); // temp file was renamed away — no half-written leftover
  expect(JSON.parse(w.text).theme).toBe(name); // final config.json holds the new theme
  void r;
  const bad = await $.command.run({ command: 'ccstatus', args: 'theme nope-x' } as any);
  expect(bad.text).toContain('unknown');
  const edit = await $.command.run({ command: 'ccstatus', args: 'edit' } as any);
  expect(edit.text).toContain('npx @sushant-kum/ccstatus');
});

test('a config with problems surfaces a warning toast on reload', async ($, on) => {
  const toasts: string[] = [];
  const w = setup($, on);
  on('ui.toast', async (_$: any, e: any) => {
    toasts.push(e.text);
    return { value: undefined } as any;
  });
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  w.text = JSON.stringify({
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'bogus' }]] } },
  });
  await $.command.run({ command: 'ccstatus', args: 'reload' } as any);
  expect(toasts.some((t) => t.includes('config had') && t.includes('problem'))).toBe(true);
});

test('refresh persists the snapshot to snapshot.json', async ($, on) => {
  const w = setup($, on);
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  expect(w.snapshots.length).toBeGreaterThan(0);
  expect(JSON.parse(w.snapshots[0] ?? '{}').version).toBe('1.2.3');
});
