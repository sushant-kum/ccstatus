# Multicolour Status Line via Native `statusLine` Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render ccstatus's status line in full colour via Claude Code's native `settings.json` `statusLine` command, and fix the band/pane background/bright colours in the mod.

**Architecture:** A new `ccstatus statusline` subcommand reads the shared `config.json` + `snapshot.json` and prints `toAnsi(render(...))` to stdout; Claude Code renders that ANSI in colour. The TUI writes the `statusLine` block into `settings.json` (opt-in, scope-prompted, backup+confirm). The mod stops using `$.ui.status`. A single core-owned colour mapping fixes band/pane colours in both hosts.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, NodeNext), zod (core), Ink/React (TUI), vitest + ink-testing-library (tests), tsup (bundle), the Claude Code mod engine.

**Spec:** `docs/superpowers/specs/2026-10-07-ccstatus-statusline-command-design.md`

## Global Constraints

- TS is strict with `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `NodeNext`; **all local imports use `.js` extensions**.
- **Every function needs JSDoc** (`flat/recommended-typescript`: descriptions, no `{type}` tags) **and an explicit return type**; `any` and non-null `!` are lint **errors**.
- **No AI-attribution** anywhere (code, files, commits, PRs).
- **Conventional Commits** (enforced by the `commit-msg` hook).
- After any change under `packages/core/src/`, run `npm run build:plugin-core` and commit the regenerated `plugin/hooks/core.{js,d.ts}` (CI drift check).
- The generated `plugin/hooks/core.{js,d.ts}` are never hand-edited and are excluded from Prettier/ESLint/cspell.
- The mod (`plugin/`) uses **static imports only**; pure modules import only `./core.js`.
- Status-line command invocation string is exactly `npx ccstatus statusline`.

## Review Focus

- **settings.json already has unrelated keys** → enabling the status line must deep-merge and preserve every other key (Task 6 test).
- **settings.json is invalid JSON** → `detectStatusline` returns `'unknown'` and `enableStatusline` refuses without clobbering the file (Task 6 test).
- **Mod not running / no live snapshot** → the `statusline` command prints an **empty** line, not stale sample data (Task 4 test).
- **`surfaces.statusline.enabled` is false** → the command prints an empty line (Task 4 test).
- **Bad/missing input to the command** → it still exits `0` (a status-line command must never error the host) (Task 5 test).

---

### Task 1: Core colour mappers (`rendererColor` / `rendererBg`)

**Files:**

- Create: `packages/core/src/renderer-colors.ts`
- Create: `packages/core/src/renderer-colors.test.ts`
- Modify: `packages/core/src/index.ts` (add two exports)

**Interfaces:**

- Produces: `rendererColor(name?: string): string | undefined`, `rendererBg(name?: string): string | undefined` — exported from `@ccstatus/core`. Map core names (`brightYellow`, `bgCyan`, `bgBrightYellow`) to Ink/chalk names (`yellowBright`, `cyan`, `yellowBright`); pass base names through; return `undefined` for no input. These are the single source of truth both hosts use.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/renderer-colors.test.ts
import { describe, expect, it } from 'vitest';

import { rendererBg, rendererColor } from './renderer-colors.js';

describe('rendererColor', () => {
  it('passes base names through', () => {
    expect(rendererColor('cyan')).toBe('cyan');
    expect(rendererColor('red')).toBe('red');
  });
  it('reorders brightX to xBright', () => {
    expect(rendererColor('brightYellow')).toBe('yellowBright');
    expect(rendererColor('brightBlack')).toBe('blackBright');
  });
  it('returns undefined for no input', () => {
    expect(rendererColor(undefined)).toBeUndefined();
  });
});

describe('rendererBg', () => {
  it('strips the bg prefix to the base name', () => {
    expect(rendererBg('bgCyan')).toBe('cyan');
    expect(rendererBg('bgRed')).toBe('red');
  });
  it('maps bgBrightX to xBright', () => {
    expect(rendererBg('bgBrightYellow')).toBe('yellowBright');
  });
  it('returns undefined for no input', () => {
    expect(rendererBg(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @ccstatus/core -- renderer-colors`
Expected: FAIL — cannot resolve `./renderer-colors.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/renderer-colors.ts
// Core uses brightX / bgX / bgBrightX. Ink (chalk) wants x / xBright and adds the
// bg prefix itself. The engine's Text is Ink's too, so both hosts share this.
const toInk = (n?: string): string | undefined => {
  if (!n) {
    return undefined;
  }
  return n.startsWith('bright') ? (n[6] ?? '').toLowerCase() + n.slice(7) + 'Bright' : n;
};

/**
 * Maps a core foreground colour name to the renderer's (Ink/chalk) colour name.
 * @param fg - The core foreground colour name, if any.
 * @returns  The renderer colour name, or undefined when no colour is given.
 */
export const rendererColor = (fg?: string): string | undefined => toInk(fg);

/**
 * Maps a core background colour name to the renderer's base colour name.
 * @param bg - The core background colour name, if any.
 * @returns  The renderer background colour name, or undefined when no colour is given.
 */
export const rendererBg = (bg?: string): string | undefined => {
  if (!bg) {
    return undefined;
  }
  return toInk(bg.startsWith('bg') ? (bg[2] ?? '').toLowerCase() + bg.slice(3) : bg);
};
```

Then add to `packages/core/src/index.ts`:

```ts
export { rendererBg, rendererColor } from './renderer-colors.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @ccstatus/core -- renderer-colors` and `npm run typecheck -w @ccstatus/core`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer-colors.ts packages/core/src/renderer-colors.test.ts packages/core/src/index.ts
git commit -m "feat(core): add rendererColor/rendererBg colour-name mappers"
```

---

### Task 2: TUI paint uses the core mappers

**Files:**

- Modify: `packages/tui/src/paint.tsx` (replace local `toInk`/`inkColor`/`inkBg` with core's mappers)

**Interfaces:**

- Consumes: `rendererColor`, `rendererBg` from `@ccstatus/core` (Task 1).
- Produces: `paintModel(model)` unchanged in behaviour; `inkColor`/`inkBg` become thin re-exports of the core mappers (kept so existing imports/tests don't break).

- [ ] **Step 1: Run the existing paint tests to establish the baseline**

Run: `npm test -w ccstatus -- paint`
Expected: PASS (records current behaviour before the refactor).

- [ ] **Step 2: Replace the local mappers with core's**

Edit `packages/tui/src/paint.tsx` — remove the local `toInk`, and define `inkColor`/`inkBg` as re-exports:

```ts
import type { RenderModel } from '@ccstatus/core';
import { rendererBg, rendererColor } from '@ccstatus/core';
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

/**
 * Maps a core foreground colour name to Ink's colour name (re-exported from core).
 * @param fg - The core foreground colour name, if any.
 * @returns  The Ink colour name, or undefined when no colour is given.
 */
export const inkColor = (fg?: string): string | undefined => rendererColor(fg);

/**
 * Maps a core background colour name to Ink's base colour name (re-exported from core).
 * @param bg - The core background colour name, if any.
 * @returns  The Ink background colour name, or undefined when no colour is given.
 */
export const inkBg = (bg?: string): string | undefined => rendererBg(bg);
```

Leave `paintModel` as-is (it already calls `inkColor`/`inkBg`).

- [ ] **Step 3: Run the paint tests + typecheck to verify unchanged behaviour**

Run: `npm test -w ccstatus -- paint` and `npm run typecheck -w ccstatus`
Expected: PASS (identical behaviour; the mapping moved to core).

- [ ] **Step 4: Commit**

```bash
git add packages/tui/src/paint.tsx
git commit -m "refactor(tui): source colour-name mapping from core"
```

---

### Task 3: Plugin paint uses the core mappers (fixes band/pane bg) + regenerate bundle

**Files:**

- Modify: `plugin/hooks/paint.tsx`
- Create: `plugin/hooks/paint.test.ts`
- Modify: `plugin/vitest.config.ts` (add the new pure test to `include`)
- Regenerate: `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`

**Interfaces:**

- Consumes: `rendererColor`, `rendererBg` from `./core.js` (bundled from Task 1).
- Produces: `paintModel` passes mapped colours to the `Text` factory: `color: rendererColor(seg.fg)`, `backgroundColor: rendererBg(seg.bg)`.

- [ ] **Step 1: Regenerate the bundle so `./core.js` exports the mappers**

Run: `npm run build:plugin-core`
Then verify: `node -e "import('./plugin/hooks/core.js').then(m => console.log(typeof m.rendererColor, typeof m.rendererBg))"`
Expected: `function function`.

- [ ] **Step 2: Write the failing pure test**

```ts
// plugin/hooks/paint.test.ts
import { describe, expect, it } from 'vitest';

import type { RenderModel } from './core.js';
import { paintModel } from './paint.js';

describe('paintModel colour mapping', () => {
  it('maps core bg/bright names to Ink names on the Text factory', () => {
    const model: RenderModel = {
      lines: [{ segments: [{ text: 'x', fg: 'brightYellow', bg: 'bgCyan' }] }],
    };
    const calls: Array<Record<string, unknown>> = [];
    const Box = (props: Record<string, unknown>): unknown => props;
    const Text = (props: Record<string, unknown>): unknown => {
      calls.push(props);
      return props;
    };
    paintModel(model, { Box, Text });
    expect(calls[0]?.color).toBe('yellowBright');
    expect(calls[0]?.backgroundColor).toBe('cyan');
  });
});
```

- [ ] **Step 3: Add the test to the pure vitest include**

Edit `plugin/vitest.config.ts` `include` array to add `'hooks/paint.test.ts'`:

```ts
include: [
  'hooks/config-io.test.ts',
  'hooks/snapshot-build.test.ts',
  'hooks/toasts.test.ts',
  'hooks/paint.test.ts',
],
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test:plugin-pure`
Expected: FAIL — `color` is `'brightYellow'`, `backgroundColor` is `'bgCyan'` (unmapped).

- [ ] **Step 5: Apply the mapping in the plugin paint module**

Edit `plugin/hooks/paint.tsx`:

```ts
import type { RenderModel } from './core.js';
import { rendererBg, rendererColor } from './core.js';
```

and the `Text(...)` call:

```ts
Text({
  key: `s${li}-${si}`,
  color: rendererColor(seg.fg),
  backgroundColor: rendererBg(seg.bg),
  children: seg.text,
});
```

- [ ] **Step 6: Run the test to verify it passes, and confirm no bundle drift beyond Step 1**

Run: `npm run test:plugin-pure` → PASS.
Run: `npm run build:plugin-core && git diff --stat plugin/hooks/core.js plugin/hooks/core.d.ts`
Expected: the only bundle change is Task 1's added exports (already staged below).

- [ ] **Step 7: Commit**

```bash
git add plugin/hooks/paint.tsx plugin/hooks/paint.test.ts plugin/vitest.config.ts plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "fix(plugin): map core colour names to Ink names so band/pane backgrounds render"
```

---

### Task 4: `ccstatus statusline` renderer

**Files:**

- Create: `packages/tui/src/statusline-cmd.ts`
- Create: `packages/tui/src/statusline-cmd.test.ts`

**Interfaces:**

- Consumes: `render`, `toAnsi`, `type Config`, `type Snapshot` from `@ccstatus/core`; `configPath`, `snapshotPath`, `loadConfigFile` from `./config-store.js`; `readSnapshot` from `./snapshot-source.js`.
- Produces:
  - `renderStatuslineAnsi(config: Config, snapshot: Snapshot): string` — pure; returns the ANSI string, or `''` when `config.surfaces.statusline.enabled` is false.
  - `runStatusline(env?: Record<string, string | undefined>): Promise<void>` — reads config + snapshot, writes the line to stdout, always resolves.

- [ ] **Step 1: Write the failing test**

```ts
// packages/tui/src/statusline-cmd.test.ts
import { loadConfig, render, toAnsi } from '@ccstatus/core';
import { describe, expect, it } from 'vitest';

import { sampleSnapshot } from './sample-snapshot.js';
import { renderStatuslineAnsi } from './statusline-cmd.js';

describe('renderStatuslineAnsi', () => {
  it('delegates to render+toAnsi for the statusline surface when enabled', () => {
    const { config } = loadConfig(undefined);
    config.surfaces.statusline.enabled = true;
    const snap = { ...sampleSnapshot, terminalWidth: 120 };
    const expected = toAnsi(render(config, snap, { surface: 'statusline', width: 120 }));
    expect(renderStatuslineAnsi(config, snap)).toBe(expected);
  });

  it('returns an empty string when the statusline surface is disabled', () => {
    const { config } = loadConfig(undefined);
    config.surfaces.statusline.enabled = false;
    expect(renderStatuslineAnsi(config, sampleSnapshot)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w ccstatus -- statusline-cmd`
Expected: FAIL — cannot resolve `./statusline-cmd.js`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/tui/src/statusline-cmd.ts
import { render, toAnsi } from '@ccstatus/core';
import type { Config, Snapshot } from '@ccstatus/core';

import { configPath, loadConfigFile, snapshotPath } from './config-store.js';
import { readSnapshot } from './snapshot-source.js';

type Env = Record<string, string | undefined>;

/**
 * Renders the status-line surface to an ANSI string for the native status line.
 * @param config   - The ccstatus config.
 * @param snapshot - The snapshot to render.
 * @returns        The ANSI string, or an empty string when the surface is disabled.
 */
export function renderStatuslineAnsi(config: Config, snapshot: Snapshot): string {
  if (!config.surfaces.statusline.enabled) {
    return '';
  }
  const width = snapshot.terminalWidth || 200;
  return toAnsi(render(config, snapshot, { surface: 'statusline', width }));
}

/**
 * Reads the shared config and live snapshot and writes the status line to stdout.
 * Prints nothing when the surface is disabled or no live snapshot exists. Always
 * resolves — a status-line command must never error the host.
 * @param env - Environment used to resolve the config/snapshot paths.
 * @returns   A promise that resolves once output has been written.
 */
export async function runStatusline(env: Env = process.env): Promise<void> {
  try {
    const { config } = loadConfigFile(configPath(env));
    const snap = readSnapshot(snapshotPath(env));
    // No live snapshot (mod not running) → print nothing rather than sample data.
    if (snap.source !== 'live') {
      return;
    }
    const line = renderStatuslineAnsi(config, snap.snapshot);
    if (line) {
      process.stdout.write(line);
    }
  } catch {
    /* never error the host */
  }
}
```

- [ ] **Step 4: Add the "no live snapshot prints nothing" test**

Append to `statusline-cmd.test.ts`:

```ts
import { runStatusline } from './statusline-cmd.js';

describe('runStatusline', () => {
  it('writes nothing when there is no live snapshot', async () => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test stub
    process.stdout.write = (s: string): boolean => (chunks.push(String(s)), true);
    try {
      // HOME points at an empty temp dir → no config.json / snapshot.json → sample source.
      await runStatusline({ HOME: '/nonexistent-ccstatus-test-home' });
    } finally {
      process.stdout.write = orig;
    }
    expect(chunks.join('')).toBe('');
  });
});
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm test -w ccstatus -- statusline-cmd` and `npm run typecheck -w ccstatus`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/statusline-cmd.ts packages/tui/src/statusline-cmd.test.ts
git commit -m "feat(tui): add ccstatus statusline renderer (config+snapshot to ANSI)"
```

---

### Task 5: `ccstatus` bin argv dispatch

**Files:**

- Modify: `packages/tui/src/index.tsx`
- Create: `packages/tui/src/index.test.ts`

**Interfaces:**

- Consumes: `runStatusline` from `./statusline-cmd.js` (Task 4).
- Produces: running the bin with `argv[2] === 'statusline'` calls `runStatusline()` and never renders Ink; otherwise it renders the TUI `App`. Dynamic `import()` keeps Ink off the statusline path.

- [ ] **Step 1: Write the failing test (statusline path exits 0, prints nothing with no snapshot)**

```ts
// packages/tui/src/index.test.ts
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const bin = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('ccstatus statusline bin', () => {
  it('exits 0 and prints nothing when there is no live snapshot', () => {
    const out = execFileSync('node', [bin, 'statusline'], {
      env: { ...process.env, HOME: '/nonexistent-ccstatus-test-home', XDG_CONFIG_HOME: '' },
      encoding: 'utf8',
    });
    expect(out).toBe('');
  });
});
```

- [ ] **Step 2: Build the bin and run the test to verify it fails**

Run: `npm run build -w ccstatus` then `npm test -w ccstatus -- index`
Expected: FAIL — the current bin always renders Ink (non-empty/garbled output or a crash under a pipe).

- [ ] **Step 3: Implement the dispatch**

Replace `packages/tui/src/index.tsx` with:

```tsx
const sub = process.argv[2];
if (sub === 'statusline') {
  const { runStatusline } = await import('./statusline-cmd.js');
  await runStatusline();
} else {
  const { render } = await import('ink');
  const { App } = await import('./app.js');
  render(<App />);
}
```

(Keep the file as `.tsx`; the JSX is only in the `else` branch. `tsup` already targets ESM with top-level `await`.)

- [ ] **Step 4: Rebuild and run the test to verify it passes**

Run: `npm run build -w ccstatus` then `npm test -w ccstatus -- index` and `npm run typecheck -w ccstatus`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/index.tsx packages/tui/src/index.test.ts
git commit -m "feat(tui): dispatch 'ccstatus statusline' to the renderer, else the TUI"
```

---

### Task 6: `statusline-setup` — detect / enable / disable the settings.json block

**Files:**

- Create: `packages/tui/src/statusline-setup.ts`
- Create: `packages/tui/src/statusline-setup.test.ts`

**Interfaces:**

- Produces:
  - `type SettingsScope = 'user' | 'project'`
  - `type StatuslineState = 'ours' | 'absent' | 'other' | 'unknown'`
  - `interface StatuslineInfo { state: StatuslineState; command?: string }`
  - `interface SettingsIo { read(path: string): string | null; write(path: string, data: string): void }`
  - `interface EnableResult { ok: boolean; message: string }`
  - `const STATUSLINE_COMMAND = 'npx ccstatus statusline'`
  - `settingsPath(scope: SettingsScope, env?: Env): string`
  - `detectStatusline(scope: SettingsScope, io?: SettingsIo, env?: Env): StatuslineInfo`
  - `enableStatusline(scope: SettingsScope, opts?: { replaceExisting?: boolean }, io?: SettingsIo, env?: Env): EnableResult`
  - `disableStatusline(scope: SettingsScope, io?: SettingsIo, env?: Env): EnableResult`

- [ ] **Step 1: Write the failing tests (merge preserves keys; invalid JSON refuses; existing other needs replace)**

```ts
// packages/tui/src/statusline-setup.test.ts
import { describe, expect, it } from 'vitest';

import {
  detectStatusline,
  enableStatusline,
  STATUSLINE_COMMAND,
  type SettingsIo,
} from './statusline-setup.js';

const env = { HOME: '/home/u' };

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w ccstatus -- statusline-setup`
Expected: FAIL — cannot resolve `./statusline-setup.js`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/tui/src/statusline-setup.ts
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
  read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
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

const isOurs = (sl: unknown): boolean =>
  !!sl &&
  typeof sl === 'object' &&
  typeof (sl as { command?: unknown }).command === 'string' &&
  (sl as { command: string }).command.includes('ccstatus statusline');

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
  const sl = (parsed as { statusLine?: unknown })?.statusLine;
  if (sl === undefined) {
    return { state: 'absent' };
  }
  if (isOurs(sl)) {
    return { state: 'ours' };
  }
  const command = (sl as { command?: unknown }).command;
  return { state: 'other', command: typeof command === 'string' ? command : undefined };
}

/**
 * Writes our statusLine block into the chosen settings.json, merging with the
 * existing content and refusing to overwrite a different statusLine unless asked.
 * @param scope - Which settings file to write.
 * @param opts  - `replaceExisting` to overwrite a different statusLine.
 * @param io    - Injectable IO (defaults to node fs with atomic write + .bak).
 * @param env   - Environment used to resolve the path.
 * @returns     Whether it was written, with a user-facing message.
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
      if (!parsed || typeof parsed !== 'object') {
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
    if (!parsed || typeof parsed !== 'object') {
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
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm test -w ccstatus -- statusline-setup` and `npm run typecheck -w ccstatus`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tui/src/statusline-setup.ts packages/tui/src/statusline-setup.test.ts
git commit -m "feat(tui): detect/enable/disable the native statusLine in settings.json"
```

---

### Task 7: TUI status-line screen (menu entry + scope prompt + backup/confirm)

**Files:**

- Create: `packages/tui/src/screens/statusline.tsx`
- Create: `packages/tui/src/screens/statusline.test.tsx`
- Modify: `packages/tui/src/screens/menu.tsx` (add a menu entry)
- Modify: `packages/tui/src/app.tsx` (route the new screen id)

**Interfaces:**

- Consumes: `ScreenProps` from `../app.js`; `SettingsScope`, `StatuslineState`, `detectStatusline`, `enableStatusline`, `disableStatusline` from `../statusline-setup.js`.
- Produces: a `Statusline` screen component; a `'statusline'` menu entry routed in `app.tsx`. The screen is a small state machine: `idle` → shows current state and keys; `u`/`p` pick scope and enable (or ask to confirm replace); `r` confirms replace; `d` disables; `esc` returns home.

- [ ] **Step 1: Write the failing screen test**

```tsx
// packages/tui/src/screens/statusline.test.tsx
import { loadConfig } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Statusline } from './statusline.js';

describe('Statusline screen', () => {
  it('shows the current detected state', () => {
    const detect = vi.fn(() => ({ state: 'absent' as const }));
    const { lastFrame } = render(
      <Statusline
        config={loadConfig(undefined).config}
        setConfig={() => {}}
        goHome={() => {}}
        detect={detect}
        enable={vi.fn()}
        disable={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('Native status line');
    expect(lastFrame()?.toLowerCase()).toContain('not configured');
  });

  it('enables for the user scope on "u"', () => {
    const enable = vi.fn(() => ({ ok: true, message: 'ok' }));
    const { stdin } = render(
      <Statusline
        config={loadConfig(undefined).config}
        setConfig={() => {}}
        goHome={() => {}}
        detect={vi.fn(() => ({ state: 'absent' as const }))}
        enable={enable}
        disable={vi.fn()}
      />
    );
    stdin.write('u');
    expect(enable).toHaveBeenCalledWith('user', expect.anything());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w ccstatus -- screens/statusline`
Expected: FAIL — cannot resolve `./statusline.js`.

- [ ] **Step 3: Implement the screen**

```tsx
// packages/tui/src/screens/statusline.tsx
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';
import {
  detectStatusline as detectDefault,
  disableStatusline as disableDefault,
  enableStatusline as enableDefault,
  type EnableResult,
  type SettingsScope,
  type StatuslineInfo,
} from '../statusline-setup.js';

interface StatuslineDeps {
  detect?: (scope: SettingsScope) => StatuslineInfo;
  enable?: (scope: SettingsScope, opts?: { replaceExisting?: boolean }) => EnableResult;
  disable?: (scope: SettingsScope) => EnableResult;
}

/**
 * Renders the native status-line setup screen: shows the detected state and lets
 * the user enable (per scope, confirming a replace) or disable it.
 * @param root0         - The screen props plus injectable setup functions (for tests).
 * @param root0.goHome  - Callback to return to the menu.
 * @param root0.detect  - Injected detector (defaults to the real one).
 * @param root0.enable  - Injected enabler (defaults to the real one).
 * @param root0.disable - Injected disabler (defaults to the real one).
 * @returns             The status-line setup screen element.
 */
export function Statusline({
  goHome,
  detect = (s): StatuslineInfo => detectDefault(s),
  enable = (s, o): EnableResult => enableDefault(s, o),
  disable = (s): EnableResult => disableDefault(s),
}: ScreenProps & StatuslineDeps): ReactElement {
  const [scope] = useState<SettingsScope>('user');
  const [info, setInfo] = useState<StatuslineInfo>(() => detect('user'));
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<SettingsScope | null>(null);

  const doEnable = (s: SettingsScope, replaceExisting: boolean): void => {
    const current = detect(s);
    if (current.state === 'other' && !replaceExisting) {
      setPendingScope(s);
      setMsg(`A different statusLine is set (${current.command ?? '?'}). Press r to replace it.`);
      return;
    }
    const r = enable(s, { replaceExisting });
    setMsg(r.message);
    setPendingScope(null);
    setInfo(detect(s));
  };

  useInput((input, key) => {
    if (key.escape) {
      goHome();
      return;
    }
    if (input === 'u') {
      doEnable('user', false);
    } else if (input === 'p') {
      doEnable('project', false);
    } else if (input === 'r' && pendingScope) {
      doEnable(pendingScope, true);
    } else if (input === 'd') {
      const r = disable(scope);
      setMsg(r.message);
      setInfo(detect(scope));
    }
  });

  const state =
    info.state === 'ours'
      ? 'configured (ccstatus)'
      : info.state === 'other'
        ? `another command: ${info.command ?? '?'}`
        : info.state === 'unknown'
          ? 'settings.json unreadable'
          : 'not configured';

  return (
    <Box flexDirection="column">
      <Text bold>Native status line</Text>
      <Text>Current: {state}</Text>
      <Text dimColor>u: enable (user) · p: enable (project) · d: disable · esc: back</Text>
      {pendingScope && <Text color="yellow">r: confirm replace</Text>}
      {msg && <Text color="cyan">{msg}</Text>}
    </Box>
  );
}
```

- [ ] **Step 4: Wire the menu entry and the route**

In `packages/tui/src/screens/menu.tsx`, add to `ITEMS` after `['surfaces', 'Surfaces']`:

```ts
['statusline', 'Native status line'],
```

In `packages/tui/src/app.tsx`, import and add a case in `PlaceholderOrScreen`:

```tsx
import { Statusline } from './screens/statusline.js';
// ...
case 'statusline':
  return <Statusline {...props} />;
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm test -w ccstatus -- screens/statusline` and `npm test -w ccstatus` and `npm run typecheck -w ccstatus`
Expected: PASS (and no other screen test regresses).

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/screens/statusline.tsx packages/tui/src/screens/statusline.test.tsx packages/tui/src/screens/menu.tsx packages/tui/src/app.tsx
git commit -m "feat(tui): add a native status-line setup screen (scope + confirm)"
```

---

### Task 8: Remove `$.ui.status` from the mod

**Files:**

- Modify: `plugin/hooks/register.tsx` (drop the statusline branch in `applySurfaces`)
- Modify: `plugin/hooks/reload.test.ts` or the relevant engine test only if it asserts `$.ui.status` (leave engine tests otherwise untouched; they run under the preview build)

**Interfaces:**

- Produces: `applySurfaces($, snap)` now only fires toasts; no `$.ui.status` call anywhere in the mod.

- [ ] **Step 1: Edit `applySurfaces`**

In `plugin/hooks/register.tsx`, replace the body of `applySurfaces` so it only fires toasts:

```tsx
/**
 * Fire any due toasts for a snapshot, never throwing. The native status line is
 * rendered by the `ccstatus statusline` settings command, not the mod.
 * @param $    - The engine interface.
 * @param snap - The current snapshot to evaluate toasts against.
 */
async function applySurfaces($: EngineInterface, snap: Snapshot): Promise<void> {
  try {
    const cfg = (await read($, config)) as Config | null;
    if (!cfg) {
      return;
    }
    await fireToasts($, cfg, snap);
  } catch {
    /* never throw from a refresh */
  }
}
```

Remove the now-unused `toAnsi` import from the `./core.js` import line if nothing else uses it (check: `render` is still used by the `ui.render` hooks; `toAnsi` is not — drop it).

- [ ] **Step 2: Update any engine test that asserted the status line**

Grep: `rg "ui.status" plugin/hooks`. If `plugin/hooks/reload.test.ts` (or another engine test) asserts `$.ui.status` was called for the statusline, update that expectation to assert it is **not** called. (These engine tests run only under the preview `claude plugin test`; keep them consistent but they are not run in CI here.)

- [ ] **Step 3: Verify the pure tests + structural check still pass, and regenerate the bundle**

Run: `npm run build:plugin-core` (no core change, but keep it in sync), `npm run test:plugin-pure`, `node scripts/check-plugin.mjs`, and `npx eslint plugin --no-error-on-unmatched-pattern`
Expected: PASS; eslint clean (no unused `toAnsi` import).

- [ ] **Step 4: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/reload.test.ts plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "refactor(plugin): stop driving the status line via \$.ui.status (native command owns it)"
```

---

### Task 9: Documentation (DEC, FLOW, CLAUDE.md)

**Files:**

- Modify: `docs/DECISION.md` (new `DEC-0013`; mark DEC-0002 and DEC-0005 superseded-in-part)
- Modify: `docs/FLOW.md` (new `FLOW-0007`)
- Modify: `CLAUDE.md` (correct the colour-name gotcha; note the `ccstatus statusline` command and the TUI settings integration; note the mod no longer uses `$.ui.status`)

**Interfaces:** none (documentation).

- [ ] **Step 1: Add `DEC-0013`**

Append to `docs/DECISION.md` (and add the index row): a new `DEC-0013 — Status line is rendered by a native settings.json command, not the mod`. Context: `$.ui.status` is plain-text and refuses control characters, so ANSI can't colour it; the native `statusLine` command renders ANSI (like ccstatusline). Decision: ship a `ccstatus statusline` command that reads config.json + snapshot.json and prints `toAnsi(render(...))`; the TUI writes the settings block (scope-prompted, backup+confirm); the mod removes `$.ui.status`; the Ink colour mapping moves to core and both hosts use it. Note it **supersedes in part** DEC-0002 (the status-line pipe) and DEC-0005 (mod elements are Ink and need the mapping). In DEC-0002 and DEC-0005, add a line: `Superseded in part by DEC-0013`.

- [ ] **Step 2: Add `FLOW-0007`**

Append to `docs/FLOW.md` (and add the index row): `FLOW-0007 — Native status-line render path`. Trigger: Claude Code repaints and runs the `statusLine` command. Participants: `settings.json` (statusLine block, written by the TUI), `ccstatus statusline` (`statusline-cmd.ts`), `config.json`, `snapshot.json` (written by the mod), `core.render`/`toAnsi`. Steps: Claude Code runs `npx ccstatus statusline` → it reads config + snapshot → renders → prints ANSI → Claude Code colours it. Branches: no live snapshot → empty line; surface disabled → empty line; command always exits 0. Also document the TUI enable flow (scope prompt, other-statusLine backup+confirm).

- [ ] **Step 3: Update `CLAUDE.md`**

- In the colour-name gotcha bullet: correct it — the mod's elements are **Ink's**, so core colour names must be mapped with `core.rendererColor`/`rendererBg` (the band/pane did not do this originally); both hosts now use the core mappers.
- In the architecture/commands: note `ccstatus statusline` (the native status-line command) and that the TUI writes the `settings.json` `statusLine` block; note the mod no longer uses `$.ui.status`.
- Reference `DEC-0013` and `FLOW-0007`.

- [ ] **Step 4: Verify docs and commit**

Run: `npm run format:check` and `npm run cspell` (add any new words to `cspell.json`).
Expected: PASS.

```bash
git add docs/DECISION.md docs/FLOW.md CLAUDE.md cspell.json
git commit -m "docs: record native status-line command (DEC-0013, FLOW-0007)"
```

---

## Final verification (before opening the PR)

- [ ] `npm run lint:error` → 0
- [ ] `npm run format:check` → clean
- [ ] `npm test -w @ccstatus/core` and `npm test -w ccstatus` → all pass
- [ ] `npm run build -w ccstatus` → builds the bin
- [ ] `npm run test:plugin-pure` and `node scripts/check-plugin.mjs` → pass
- [ ] `npm run build:plugin-core` → `git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts` is clean (bundle committed)
- [ ] `npm run cspell`, `npm run secretlint`, `npm run knip` → pass
- [ ] Manual (author, needs the preview engine): `/reload-plugins`, enable the status line from the TUI, confirm the native status line is multicolour and the band/pane show backgrounds.
