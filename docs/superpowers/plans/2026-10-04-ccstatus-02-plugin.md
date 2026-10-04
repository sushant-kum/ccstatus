# ccstatus Plan 2 — Plugin (the mod) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementers building mod code MUST consult the plugin-authoring skill's type declaration (`claude-code.d.ts`) for exact `$`/event/element signatures.

**Goal:** Build the `ccstatus` Claude Code plugin (mod) that reads the shared JSON config, gathers a live `Snapshot`, and renders the configured bar to four surfaces — the above-prompt band (flagship), the native status line, an openable pane, and threshold toasts — driven by `@ccstatus/core`.

**Architecture:** `@ccstatus/core` is bundled (with zod inlined) into `plugin/hooks/core.js` by tsup, because the mod's module environment has no `node_modules` resolution. The plugin keeps its decision logic in **pure, framework-free modules** (snapshot building, git parsing, config path/parse, toast evaluation) that import only `./core.js`, and a thin `register.tsx` adapter that wires them to the engine (`$`) and paints `RenderModel` segments to surface elements. This keeps the bulk of the plugin unit-testable and the engine-touching surface small.

**Tech Stack:** TypeScript (ESM), Claude Code mod API (`claude-code`), tsup (bundles core into the plugin), `claude plugin validate` / `claude plugin test` for the mod toolchain. Node ≥ 20.

**Spec:** `docs/superpowers/specs/2026-10-04-ccstatus-design.md`
**Builds on:** `@ccstatus/core` (Plan 1), already on this branch. Public API: `render(config, snapshot, { surface, width, commandOutputs? }) → RenderModel`, `toAnsi(RenderModel) → string`, `loadConfig(raw) → { config, warnings }`, `defaultConfig`, and types `Snapshot`, `Config`, `RenderModel`, `Segment`, `ToastRule`.
**Seed:** the existing hand-built mod at `~/.claude/plugins/ccstatusline-band/hooks/register.tsx` is the reference for engine usage (`$.session.*`, git via `$.process.run`, `$.clock.every`, `ui.render` on `AbovePrompt`, `atom`/`read`/`update`). Port its patterns; do not copy its fixed layout.

## Global Constraints

- The plugin lives at `plugin/` in the repo (publishable). Three manifest files: `plugin/.claude-plugin/plugin.json`, `plugin/hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`), `plugin/hooks/register.tsx`. A `$.state` mod also has `plugin/types/index.d.ts` named in `plugin.json` as `"types"`.
- `@ccstatus/core` is BUNDLED into `plugin/hooks/core.js` (+ `core.d.ts`) by tsup with zod inlined — the mod env has no `node_modules`. Plugin modules import values from `./core.js` and types with `import type ... from './core.js'`. `plugin/hooks/core.js` and `core.d.ts` are generated artifacts — **gitignored, never hand-edited**; `npm run build:plugin-core` regenerates them.
- `register.tsx` (and `paint.tsx`) may import from `claude-code` and `./core.js`. The PURE modules (`config-io.ts`, `toasts.ts`, `snapshot-build.ts`, `git-parse.ts`) import ONLY from `./core.js` — never from `claude-code` — so they run under the test runner without the engine.
- The mod must NEVER crash or hang the session: every `$` call that can fail is wrapped (`.catch`), a failed/missing config falls back to `defaultConfig`, and a render hook returns `next(e)` (let the engine draw) rather than throwing.
- Config location: `$XDG_CONFIG_HOME/ccstatus/config.json`, else `$HOME/.config/ccstatus/config.json`.
- The band is seeded from `ccstatusline-band`: refresh snapshot on a 2s `$.clock.every`, capture thinking-effort from `turn.complete`/`tool.call`, size the band to `e.props.bodyColumns`, skip when `e.props.hasSurvey`.
- Plugin tests run via `claude plugin test plugin` using `import { test, expect, mock } from 'claude-code/testing'`. Pure-logic tests use `test`/`expect`; UI/hook tests use the kit's engine `$` and `mount`. Implementers reconcile kit calls against the `claude-code/testing` typings laid beside the mod.
- `claude plugin validate plugin` must pass at every task that changes hooks/manifest.

## Review Focus

Inputs the spec implies that are most likely to bite; each gets a test in the owning task:

- **Config file absent** — first run with no `~/.config/ccstatus/config.json` → the band renders `defaultConfig`, no crash, no error toast. (Task 2 for the parse/fallback; Task 5 for the wired render)
- **Config file present but invalid JSON** — kept-last-good or defaultConfig with a logged warning, never a thrown hook. (Task 2)
- **Not in a git repo / git missing** — snapshot `repo:false`, git widgets omit, no shell error surfaced. (Task 4)
- **`$.session.usage` returns null / partial** — snapshot fields degrade to null (cost/limits), no `NaN`. (Task 4)
- **Terminal narrower than the band** — band sized to `bodyColumns` truncates (core handles), the hook never throws. (Task 5)
- **A toast rule that would fire every refresh** — `once` rules fire exactly once; repeated-fire rules debounced, not spammed every 2s. (Task 3 pure eval; Task 8 wiring)

---

## File Structure

```
ccstatus/
├─ package.json                      # add devDep tsup + script build:plugin-core (Task 1)
├─ .gitignore                        # add plugin/hooks/core.js, plugin/hooks/core.d.ts (Task 1)
└─ plugin/
   ├─ .claude-plugin/plugin.json     # name/version/description/types (Task 1)
   ├─ hooks/
   │  ├─ hooks.json                  # { "modules": ["./register.tsx"] } (Task 1)
   │  ├─ core.js                     # GENERATED bundle (Task 1) — gitignored
   │  ├─ core.d.ts                   # GENERATED types (Task 1) — gitignored
   │  ├─ config-io.ts                # configPath(), parseConfig() [pure] (Task 2)
   │  ├─ toasts.ts                   # evalWhen(), dueToasts() [pure] (Task 3)
   │  ├─ git-parse.ts                # parseGit() [pure] (Task 4)
   │  ├─ snapshot-build.ts           # buildSnapshot() [pure] (Task 4)
   │  ├─ paint.tsx                   # paintModel() segments→elements (Task 5)
   │  ├─ register.tsx                # hooks adapter (Tasks 5–9)
   │  ├─ *.test.ts                   # claude plugin test files
   └─ types/index.d.ts              # PluginState contract (Task 10)
```

---

### Task 1: Plugin scaffold + core bundle + toolchain gate

**Files:**
- Create: `plugin/.claude-plugin/plugin.json`, `plugin/hooks/hooks.json`, `plugin/hooks/register.tsx` (minimal)
- Modify: root `package.json` (devDep `tsup`, script `build:plugin-core`), `.gitignore`
- Test: `plugin/hooks/smoke.test.ts`

**Interfaces:**
- Produces: a loadable plugin named `ccstatus` registering the `/ccstatus` command; `plugin/hooks/core.js` + `core.d.ts` bundled from `@ccstatus/core`; `npm run build:plugin-core` regenerates them; `claude plugin validate plugin` passes; `claude plugin test plugin` runs.

- [ ] **Step 1: Add the bundle script and tsup**

In root `package.json` add to `devDependencies`: `"tsup": "^8.0.0"`, and to `scripts`:
```json
"build:plugin-core": "tsup --entry.core=packages/core/src/index.ts --format esm --dts --clean=false --out-dir plugin/hooks"
```
Run `npm install`.

- [ ] **Step 2: Build the core bundle**

Run: `npm run build:plugin-core`
Expected: creates `plugin/hooks/core.js` and `plugin/hooks/core.d.ts`. Verify zod is inlined (no `import ... from "zod"` remains): `grep -c "from \"zod\"\|from 'zod'" plugin/hooks/core.js` prints `0`.

- [ ] **Step 3: gitignore the generated bundle**

In `.gitignore` replace the line `plugin/hooks/core/` with:
```
plugin/hooks/core.js
plugin/hooks/core.d.ts
```

- [ ] **Step 4: Write the manifest files**

```json
// plugin/.claude-plugin/plugin.json
{
  "name": "ccstatus",
  "version": "0.1.0",
  "description": "A configurable status bar for Claude Code — band, status line, pane, and toasts driven by one config; configured with npx ccstatus or /ccstatus.",
  "types": "./types/index.d.ts"
}
```
```json
// plugin/hooks/hooks.json
{ "modules": ["./register.tsx"] }
```

(`types/index.d.ts` is created in Task 10; `plugin.json` naming it ahead of time is fine for validate — but if `claude plugin validate` errors on a missing types file, create a stub `plugin/types/index.d.ts` containing `export {}` now and flesh it out in Task 10.)

- [ ] **Step 5: Write a minimal register.tsx**

```tsx
// plugin/hooks/register.tsx
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ccstatus',
      description: 'Toggle the ccstatus band above the prompt',
    })
    return next(e)
  })

  on('command.run', { command: 'ccstatus' }, async () => {
    return { text: 'ccstatus: not wired yet' }
  })
}
```

- [ ] **Step 6: Write a smoke test**

```ts
// plugin/hooks/smoke.test.ts
import { test, expect } from 'claude-code/testing'

test('core bundle is importable and renders', async () => {
  const core = await import('./core.js')
  expect(typeof core.render).toBe('function')
  expect(typeof core.loadConfig).toBe('function')
  const { config } = core.loadConfig(undefined)
  expect(config.version).toBe(1)
})
```

- [ ] **Step 7: Toolchain gate — validate + test**

Run: `claude plugin validate plugin` → Expected: no errors (hooks/manifest recognized).
Run: `claude plugin test plugin` → Expected: the smoke test PASSES.
If either command is unavailable or behaves differently in this environment, STOP and report as BLOCKED with the exact output — the controller will rule on the test approach before continuing.

- [ ] **Step 8: Commit**

```bash
git add plugin package.json package-lock.json .gitignore
git commit -m "feat(plugin): scaffold ccstatus mod with bundled core and toolchain gate"
```

---

### Task 2: Config I/O (path + parse) — pure

**Files:**
- Create: `plugin/hooks/config-io.ts`
- Test: `plugin/hooks/config-io.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `Config` from `./core.js`.
- Produces:
  - `configPath(env: Record<string, string | undefined>): string` — `${XDG_CONFIG_HOME}/ccstatus/config.json` when `XDG_CONFIG_HOME` is set and absolute, else `${HOME}/.config/ccstatus/config.json`. Uses `/` separators.
  - `parseConfig(text: string | null): { config: Config; warnings: string[] }` — `null` (file absent) → `loadConfig(undefined)`; non-JSON text → `loadConfig(undefined)` plus a warning `config file is not valid JSON`; valid JSON → `loadConfig(parsed)`.

- [ ] **Step 1: Write the failing tests**

```ts
// plugin/hooks/config-io.test.ts
import { test, expect } from 'claude-code/testing'
import { configPath, parseConfig } from './config-io.js'

test('configPath prefers XDG_CONFIG_HOME', () => {
  expect(configPath({ XDG_CONFIG_HOME: '/x/.config', HOME: '/home/u' }))
    .toBe('/x/.config/ccstatus/config.json')
})
test('configPath falls back to HOME/.config', () => {
  expect(configPath({ HOME: '/home/u' })).toBe('/home/u/.config/ccstatus/config.json')
})
test('absent file yields default config, no warnings', () => {
  const { config, warnings } = parseConfig(null)
  expect(config.version).toBe(1)
  expect(warnings).toEqual([])
})
test('invalid JSON yields default config with a warning', () => {
  const { config, warnings } = parseConfig('{not json')
  expect(config.version).toBe(1)
  expect(warnings.some(w => w.includes('JSON'))).toBe(true)
})
test('valid JSON is loaded through core', () => {
  const raw = JSON.stringify({ version: 1, surfaces: { band: { enabled: false, lines: [] } } })
  const { config } = parseConfig(raw)
  expect(config.surfaces.band.enabled).toBe(false)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test plugin` (filter to config-io if the kit supports it)
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// plugin/hooks/config-io.ts
import { loadConfig } from './core.js'
import type { Config } from './core.js'

export function configPath(env: Record<string, string | undefined>): string {
  const xdg = env['XDG_CONFIG_HOME']
  const base = xdg && xdg.startsWith('/') ? xdg : `${env['HOME'] ?? ''}/.config`
  return `${base}/ccstatus/config.json`
}

export function parseConfig(text: string | null): { config: Config; warnings: string[] } {
  if (text === null) return loadConfig(undefined)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const fallback = loadConfig(undefined)
    return { config: fallback.config, warnings: ['config file is not valid JSON; using defaults'] }
  }
  return loadConfig(parsed)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `claude plugin test plugin`
Expected: the 5 config-io tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/config-io.ts plugin/hooks/config-io.test.ts
git commit -m "feat(plugin): config path resolution and parse with fallback"
```

---

### Task 3: Toast evaluation — pure

**Files:**
- Create: `plugin/hooks/toasts.ts`
- Test: `plugin/hooks/toasts.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `ToastRule` from `./core.js`.
- Produces:
  - `evalWhen(when: string, snapshot: Snapshot): boolean` — parses `"<field> <op> <number>"` where `field ∈ {ctxPct, fivePct, weekPct, ctxTokens, total, cost}`, `op ∈ {>, >=, <, <=, ==}`. Unknown field or unparseable → `false`. A null snapshot field (e.g. `fivePct`) → `false`.
  - `dueToasts(rules: ToastRule[], snapshot: Snapshot, fired: Record<string, boolean>): { text: string; key: string }[]` — a rule's `key` is its `when` string; include it when `evalWhen` is true AND, if `rule.once`, it is not already `fired[key]`. (Caller marks keys fired and clears them when the condition goes false; `dueToasts` is pure and does not mutate.)

- [ ] **Step 1: Write the failing tests**

```ts
// plugin/hooks/toasts.test.ts
import { test, expect } from 'claude-code/testing'
import type { Snapshot } from './core.js'
import { dueToasts, evalWhen } from './toasts.js'

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  version: '', model: '', effort: null, cwd: '', repo: false, gitRoot: '', gitBranch: '',
  gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 0, ctxPct: 0,
  cached: 0, input: 0, output: 0, total: 0, startedAt: 0, cost: null,
  fivePct: null, fiveReset: null, weekPct: null, weekReset: null, blockReset: null,
  terminalWidth: 0, now: 0, ...over,
})

test('evalWhen compares fields', () => {
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 85 }))).toBe(true)
  expect(evalWhen('ctxPct>80', snap({ ctxPct: 50 }))).toBe(false)
  expect(evalWhen('fivePct>=90', snap({ fivePct: 90 }))).toBe(true)
})
test('evalWhen is false for null field or garbage', () => {
  expect(evalWhen('fivePct>80', snap({ fivePct: null }))).toBe(false)
  expect(evalWhen('nonsense', snap())).toBe(false)
  expect(evalWhen('bogus>5', snap())).toBe(false)
})
test('dueToasts respects once + fired', () => {
  const rules = [{ when: 'ctxPct>80', text: 'ctx high', once: true }]
  const s = snap({ ctxPct: 90 })
  expect(dueToasts(rules, s, {})).toEqual([{ text: 'ctx high', key: 'ctxPct>80' }])
  expect(dueToasts(rules, s, { 'ctxPct>80': true })).toEqual([])
})
test('dueToasts without once fires regardless of fired', () => {
  const rules = [{ when: 'ctxPct>80', text: 'ctx high' }]
  const s = snap({ ctxPct: 90 })
  expect(dueToasts(rules, s, { 'ctxPct>80': true })).toHaveLength(1)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test plugin`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// plugin/hooks/toasts.ts
import type { Snapshot, ToastRule } from './core.js'

const FIELDS: Record<string, (s: Snapshot) => number | null> = {
  ctxPct: s => s.ctxPct,
  fivePct: s => s.fivePct,
  weekPct: s => s.weekPct,
  ctxTokens: s => s.ctxTokens,
  total: s => s.total,
  cost: s => s.cost,
}

export function evalWhen(when: string, snapshot: Snapshot): boolean {
  const m = /^\s*([a-zA-Z]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(when)
  if (!m) return false
  const getter = FIELDS[m[1]!]
  if (!getter) return false
  const value = getter(snapshot)
  if (value === null || value === undefined || Number.isNaN(value)) return false
  const n = Number(m[3])
  switch (m[2]) {
    case '>': return value > n
    case '>=': return value >= n
    case '<': return value < n
    case '<=': return value <= n
    case '==': return value === n
    default: return false
  }
}

export function dueToasts(
  rules: ToastRule[], snapshot: Snapshot, fired: Record<string, boolean>,
): { text: string; key: string }[] {
  const out: { text: string; key: string }[] = []
  for (const rule of rules) {
    if (!evalWhen(rule.when, snapshot)) continue
    if (rule.once && fired[rule.when]) continue
    out.push({ text: rule.text, key: rule.when })
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `claude plugin test plugin`
Expected: the toast tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/toasts.ts plugin/hooks/toasts.test.ts
git commit -m "feat(plugin): pure toast-rule evaluation"
```

---

### Task 4: Snapshot building (git parse + buildSnapshot) — pure

**Files:**
- Create: `plugin/hooks/git-parse.ts`, `plugin/hooks/snapshot-build.ts`
- Test: `plugin/hooks/snapshot-build.test.ts`

**Interfaces:**
- Consumes: `Snapshot` from `./core.js`.
- Produces:
  - `type GitFields = { repo: boolean; root: string; branch: string; worktree: string; added: number; modified: number; deleted: number }`.
  - `parseGit(stdout: string): GitFields` — parses the tab-delimited line the git script emits (see Task 5's shell): `YES\t<root>\t<branch>\t<worktree>\t<added>\t<modified>\t<deleted>`; anything not starting `YES` → `{ repo: false, ... zeros }`.
  - `type RawUsage = { ctxTokens: number; ctxPct: number; cached: number; input: number; output: number; startedAt: number; fivePct: number | null; fiveReset: string | null; weekPct: number | null; weekReset: string | null } | null`.
  - `buildSnapshot(raw: { version: string; model: string; effort: string | null; cwd: string; now: number; git: GitFields; usage: RawUsage }): Snapshot` — assembles a `Snapshot`; `total = cached + input + output`; `cost: null` and `blockReset: null` (best-effort, deferred); `terminalWidth: 0` (width is passed at render time); null usage → all usage fields degrade to 0/null with no NaN.

- [ ] **Step 1: Write the failing tests**

```ts
// plugin/hooks/snapshot-build.test.ts
import { test, expect } from 'claude-code/testing'
import { parseGit } from './git-parse.js'
import { buildSnapshot } from './snapshot-build.js'

test('parseGit reads the tab line', () => {
  expect(parseGit('YES\tapp\tmain\twt\t1\t2\t3')).toEqual({
    repo: true, root: 'app', branch: 'main', worktree: 'wt', added: 1, modified: 2, deleted: 3,
  })
})
test('parseGit handles no-repo', () => {
  expect(parseGit('NO')).toEqual({
    repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0,
  })
})
test('buildSnapshot assembles totals and handles null usage', () => {
  const git = { repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0 }
  const s = buildSnapshot({ version: '2.1.0', model: 'Opus', effort: 'high', cwd: '/a/app', now: 1000, git, usage: null })
  expect(s.total).toBe(0)
  expect(s.cost).toBeNull()
  expect(s.fivePct).toBeNull()
  expect(Number.isNaN(s.ctxTokens)).toBe(false)
  expect(s.model).toBe('Opus')
})
test('buildSnapshot computes total from usage', () => {
  const git = { repo: true, root: 'app', branch: 'main', worktree: '', added: 0, modified: 0, deleted: 0 }
  const usage = { ctxTokens: 42000, ctxPct: 21, cached: 1000, input: 2000, output: 500, startedAt: 0, fivePct: 30, fiveReset: null, weekPct: 10, weekReset: null }
  const s = buildSnapshot({ version: '', model: '', effort: null, cwd: '', now: 0, git, usage })
  expect(s.total).toBe(3500)
  expect(s.repo).toBe(true)
  expect(s.gitBranch).toBe('main')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test plugin`
Expected: FAIL.

- [ ] **Step 3: Implement git-parse**

```ts
// plugin/hooks/git-parse.ts
export type GitFields = {
  repo: boolean; root: string; branch: string; worktree: string
  added: number; modified: number; deleted: number
}

const none: GitFields = { repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0 }

export function parseGit(stdout: string): GitFields {
  const t = (stdout || '').trim().split('\t')
  if (t[0] !== 'YES') return { ...none }
  return {
    repo: true,
    root: t[1] ?? '',
    branch: t[2] ?? '',
    worktree: t[3] ?? '',
    added: Number(t[4]) || 0,
    modified: Number(t[5]) || 0,
    deleted: Number(t[6]) || 0,
  }
}
```

- [ ] **Step 4: Implement buildSnapshot**

```ts
// plugin/hooks/snapshot-build.ts
import type { Snapshot } from './core.js'
import type { GitFields } from './git-parse.js'

export type RawUsage = {
  ctxTokens: number; ctxPct: number
  cached: number; input: number; output: number; startedAt: number
  fivePct: number | null; fiveReset: string | null
  weekPct: number | null; weekReset: string | null
} | null

export function buildSnapshot(raw: {
  version: string; model: string; effort: string | null; cwd: string; now: number
  git: GitFields; usage: RawUsage
}): Snapshot {
  const u = raw.usage
  const cached = u?.cached ?? 0
  const input = u?.input ?? 0
  const output = u?.output ?? 0
  return {
    version: raw.version,
    model: raw.model,
    effort: raw.effort,
    cwd: raw.cwd,
    repo: raw.git.repo,
    gitRoot: raw.git.root,
    gitBranch: raw.git.branch,
    gitWorktree: raw.git.worktree,
    added: raw.git.added,
    modified: raw.git.modified,
    deleted: raw.git.deleted,
    ctxTokens: u?.ctxTokens ?? 0,
    ctxPct: u?.ctxPct ?? 0,
    cached, input, output,
    total: cached + input + output,
    startedAt: u?.startedAt ?? 0,
    cost: null,
    fivePct: u?.fivePct ?? null,
    fiveReset: u?.fiveReset ?? null,
    weekPct: u?.weekPct ?? null,
    weekReset: u?.weekReset ?? null,
    blockReset: null,
    terminalWidth: 0,
    now: raw.now,
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `claude plugin test plugin`
Expected: the 4 snapshot tests PASS.

- [ ] **Step 6: Commit**

```bash
git add plugin/hooks/git-parse.ts plugin/hooks/snapshot-build.ts plugin/hooks/snapshot-build.test.ts
git commit -m "feat(plugin): pure git parsing and snapshot assembly"
```

---

### Task 5: Band rendering + collection wiring + /ccstatus toggle

**Files:**
- Create: `plugin/hooks/paint.tsx`
- Modify: `plugin/hooks/register.tsx` (full wiring)
- Test: `plugin/hooks/band.test.ts`

**Interfaces:**
- Consumes: `render`, `Config`, `Snapshot`, `RenderModel`, `Segment` from `./core.js`; `buildSnapshot`, `parseGit`, `configPath`, `parseConfig`; engine `$`, `atom`, `read`, `update` from `claude-code`.
- Produces:
  - `paint.tsx`: `paintModel(model: RenderModel, el: { Box: any; Text: any }): unknown` — returns a column `Box` of one `Box` per line, each a row of `Text` nodes (`<Text color={seg.fg} backgroundColor={seg.bg}>{seg.text}</Text>`). (Typed loosely so it is unit-testable with stub element factories AND works with `$.ui.resolve` elements.)
  - `register.tsx`: `session.start` registers `/ccstatus`, loads config from disk, takes first snapshot, starts `$.clock.every(2000)` refresh; `turn.complete`/`tool.call` capture effort + refresh; `ui.render` `{ component: 'AbovePrompt' }` paints the band when visible; `command.run { command: 'ccstatus' }` toggles a `visible` atom.
- PluginState atoms (declared fully in Task 10): `visible: boolean`, `snapshot: Snapshot | null`, `config: Config`, `effort: string | null`.

- [ ] **Step 1: Write paint with a unit test (stub elements)**

```ts
// plugin/hooks/band.test.ts
import { test, expect } from 'claude-code/testing'
import { paintModel } from './paint.js'

test('paintModel builds one row per line with a node per segment', () => {
  const Box = (props: any, ...children: any[]) => ({ t: 'Box', props, children })
  const Text = (props: any, ...children: any[]) => ({ t: 'Text', props, children })
  const model = { lines: [{ segments: [
    { kind: 'cell', text: ' a ', fg: 'black', bg: 'bgCyan' },
    { kind: 'separator', text: '▒', fg: 'cyan', bg: 'bgBlue' },
    { kind: 'cell', text: ' b ', fg: 'white', bg: 'bgBlue' },
  ] }] }
  const tree: any = paintModel(model, { Box, Text })
  // outer column Box → 1 line Box → 3 Text nodes
  expect(tree.t).toBe('Box')
  const line = tree.children[0]
  expect(line.children).toHaveLength(3)
  expect(line.children[0].props.backgroundColor).toBe('bgCyan')
  expect(line.children[1].props.color).toBe('cyan')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test plugin`
Expected: FAIL.

- [ ] **Step 3: Implement paint.tsx**

Write `paintModel` without JSX so it is agnostic to the element source (works with stub factories in tests and `$.ui.resolve` elements at runtime):
```tsx
// plugin/hooks/paint.tsx
import type { RenderModel } from './core.js'

export function paintModel(
  model: RenderModel,
  el: { Box: any; Text: any },
): unknown {
  const { Box, Text } = el
  const lines = model.lines.map((line, li) =>
    Box(
      { key: `l${li}`, flexDirection: 'row' },
      ...line.segments.map((seg, si) =>
        Text({ key: `s${li}-${si}`, color: seg.fg, backgroundColor: seg.bg }, seg.text),
      ),
    ),
  )
  return Box({ flexDirection: 'column' }, ...lines)
}
```
(The engine's resolved `Box`/`Text` are callable element constructors; calling them directly is equivalent to JSX `h(Box, props, ...children)`.)

- [ ] **Step 4: Implement register.tsx (full band wiring)**

Port collection from the seed mod. Key shape (adjust field access to the engine's `usage` type — see `claude-code.d.ts` for `$.session.usage` result):
```tsx
// plugin/hooks/register.tsx
import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import { render } from './core.js'
import type { Config, Snapshot } from './core.js'
import { configPath, parseConfig } from './config-io.js'
import { parseGit } from './git-parse.js'
import { buildSnapshot, type RawUsage } from './snapshot-build.js'
import { paintModel } from './paint.js'

const visible = atom({ plugin: 'ccstatus', key: 'visible' } as const, true)
const snapshot = atom({ plugin: 'ccstatus', key: 'snapshot' } as const, null)
const config = atom({ plugin: 'ccstatus', key: 'config' } as const, null)
const effort = atom({ plugin: 'ccstatus', key: 'effort' } as const, null)

const GIT = 'r=$(git rev-parse --show-toplevel 2>/dev/null)||{ printf NO;exit 0;};'
  + 'b=$(git rev-parse --abbrev-ref HEAD 2>/dev/null);'
  + 'w=$(git rev-parse --show-toplevel 2>/dev/null|xargs -I{} sh -c "git -C {} rev-parse --git-dir" 2>/dev/null);'
  + 's=$(git status --porcelain 2>/dev/null);'
  + 'a=$(printf "%s\\n" "$s"|grep -cE "^(A.|.A|\\?\\?)");'
  + 'm=$(printf "%s\\n" "$s"|grep -cE "^(M.|.M)");'
  + 'd=$(printf "%s\\n" "$s"|grep -cE "^(D.|.D)");'
  + 'printf "YES\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s" "$(basename "$r")" "$b" "" "$a" "$m" "$d"'

async function loadConfigFromDisk($: EngineInterface): Promise<Config> {
  try {
    const path = configPath($.env ?? (process?.env ?? {}))
    const text = await $.fs.read(path).catch(() => null)
    return parseConfig(text).config
  } catch {
    return parseConfig(null).config
  }
}

async function measure($: EngineInterface, eff: string | null): Promise<Snapshot> {
  const [version, model, cwd, usageRaw] = await Promise.all([
    $.session.version().then(v => v.version).catch(() => ''),
    $.session.model().catch(() => ''),
    $.session.cwd().catch(() => ''),
    $.session.usage({ breakdown: 'summary' }).catch(() => null),
  ])
  let git = parseGit('NO')
  if (cwd) {
    try {
      const { stdout } = await $.process.run(['sh', '-c', GIT], { cwd, timeoutMs: 5000 })
      git = parseGit(stdout || '')
    } catch { /* keep no-repo */ }
  }
  const b = usageRaw?.context?.breakdown ?? null
  const u = b?.apiUsage ?? null
  const rl = usageRaw?.rateLimits ?? []
  const five = rl.find((r: any) => r.kind === 'five_hour') ?? null
  const week = rl.find((r: any) => r.kind === 'seven_day') ?? null
  const usage: RawUsage = {
    ctxTokens: b?.totalTokens ?? usageRaw?.context?.tokens ?? 0,
    ctxPct: b?.percentage ?? usageRaw?.context?.percent ?? 0,
    cached: u ? u.cache_read_input_tokens + u.cache_creation_input_tokens : 0,
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    startedAt: usageRaw?.startedAt ?? 0,
    fivePct: five?.percentUsed ?? null,
    fiveReset: five?.resetsAt ?? null,
    weekPct: week?.percentUsed ?? null,
    weekReset: week?.resetsAt ?? null,
  }
  return buildSnapshot({ version, model, effort: eff, cwd, now: await $.clock.now(), git, usage })
}

let refreshing = false
async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const eff = await read($, effort).catch(() => null)
    const s = await measure($, eff)          // compute first, then write (updater is sync)
    await update($, snapshot, () => s)
  } catch { /* keep last snapshot */ }
  finally { refreshing = false }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ccstatus', description: 'Toggle the ccstatus band above the prompt' })
    const cfg = await loadConfigFromDisk($)      // compute first, then write (updater is sync)
    await update($, config, () => cfg)
    await refresh($)
    $.clock.every(2000, () => void refresh($))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const active = (e as any)?.effort?.active
    if (typeof active === 'string' && active) await update($, effort, () => active)
    await refresh($)
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    const active = (e as any)?.effort?.active
    if (typeof active === 'string' && active) void update($, effort, () => active)
    return next(e)
  })

  on('command.run', { command: 'ccstatus' }, async $ => {
    const now = !(await read($, visible))
    await update($, visible, () => now)
    return { text: now ? 'ccstatus band shown.' : 'ccstatus band hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, visible))) return next(e)
    const cfg = await read($, config)
    const snap = await read($, snapshot)
    if (!cfg || !snap) return next(e)
    const model = render(cfg, snap, { surface: 'band', width: e.props.bodyColumns || 0 })
    if (model.lines.length === 0) return next(e)
    const el = $.ui.resolve(e)
    return paintModel(model, el as any)
  })
}
```
NOTE: `measure`'s `await read(...)` for effort inside a non-hook helper needs the live `$`; simplify by passing the already-read effort in — the implementer should read `effort` where `$` is in scope (in `refresh`/the hook) and pass it into `measure`, rather than the `{ state: $.state }` shim shown. Resolve this against the real `read`/`$.state` signatures in `claude-code.d.ts`; keep the behavior (effort flows into the snapshot). Also confirm `$.env` exists; if not, read env via the documented noun (see `claude-code.d.ts`), falling back to `{}`.

- [ ] **Step 5: Write the band behavior test**

```ts
// append to band.test.ts
import { test, expect, mock } from 'claude-code/testing'
// Mount the AbovePrompt component through the plugin on each surface and assert
// the painted tree contains the default band's text. Use the kit's ui.mount /
// render + find API (see claude-code/testing typings). Example shape:
for (const surface of ['terminal', 'desktop'] as const) {
  test(`band renders default config text on ${surface}`, async (t) => {
    // Arrange: stub $.session/$.process so measure() yields a known snapshot,
    // seed config atom with defaultConfig, set visible=true, then mount AbovePrompt
    // with props { bodyColumns: 120, hasSurvey: false } and assert the tree's text
    // contains 'Ctx' (from the default band line).
  })
}
```
Implement these two mount tests concretely against the `claude-code/testing` kit (the typings are the authority): seed the `snapshot` and `config` atoms, mount `AbovePrompt`, and assert the rendered text includes a default-band token (e.g. `Ctx`). If the kit cannot seed atoms directly, drive `session.start` with mocked `$.session`/`$.process` first.

- [ ] **Step 6: Run validate + tests**

Run: `claude plugin validate plugin` → no errors.
Run: `claude plugin test plugin` → paint unit test + band mount tests PASS.

- [ ] **Step 7: Commit**

```bash
git add plugin/hooks/paint.tsx plugin/hooks/register.tsx plugin/hooks/band.test.ts
git commit -m "feat(plugin): render configured band above the prompt with /ccstatus toggle"
```

---

### Task 6: Native status line surface

**Files:**
- Modify: `plugin/hooks/register.tsx`
- Test: `plugin/hooks/statusline.test.ts`

**Interfaces:**
- Consumes: `toAnsi`, `render` from `./core.js`; `$.ui.status`.
- Produces: on each refresh, if `config.surfaces.statusline.enabled`, set `$.ui.status(toAnsi(render(cfg, snap, { surface: 'statusline', width })))`; when disabled, clear it once with `$.ui.status(undefined)`.

- [ ] **Step 1: Write the failing test**

```ts
// plugin/hooks/statusline.test.ts
import { test, expect } from 'claude-code/testing'
import { toAnsi, render, defaultConfig } from './core.js'

test('statusline surface serializes to an ANSI string when enabled', () => {
  const cfg = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    statusline: { enabled: true, lines: defaultConfig.surfaces.band.lines } } }
  const snap = { version: '9.9.9', model: 'M', effort: null, cwd: '/a/b', repo: false,
    gitRoot: '', gitBranch: '', gitWorktree: '', added: 0, modified: 0, deleted: 0,
    ctxTokens: 1000, ctxPct: 5, cached: 0, input: 0, output: 0, total: 0, startedAt: 0,
    cost: null, fivePct: null, fiveReset: null, weekPct: null, weekReset: null,
    blockReset: null, terminalWidth: 0, now: 0 }
  const s = toAnsi(render(cfg, snap, { surface: 'statusline', width: 80 }))
  expect(s).toContain('v9.9.9')
})
```
(This pins the core→statusline string the hook uses. The hook wiring that calls `$.ui.status` is covered by the Task 5 refresh path; add a focused hook test if the kit exposes `$.ui.status` capture.)

- [ ] **Step 2: Run to verify it fails** — `claude plugin test plugin` (module/behavior not present). 

- [ ] **Step 3: Implement** — in `register.tsx` `refresh()` (after snapshot update), read `config`, and:
```tsx
const cfg = await read($, config)
const snap = await read($, snapshot)
if (cfg && snap) {
  if (cfg.surfaces.statusline.enabled) {
    $.ui.status(toAnsi(render(cfg, snap, { surface: 'statusline', width: 0 })))
  } else {
    $.ui.status(undefined)
  }
}
```
Import `toAnsi` from `./core.js`. (Width 0 lets core lay a single line without truncation; adjust if a width source is available.)

- [ ] **Step 4: Run to verify it passes** — `claude plugin test plugin`.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/statusline.test.ts
git commit -m "feat(plugin): drive the native status line from the statusline surface"
```

---

### Task 7: Pane surface

**Files:**
- Modify: `plugin/hooks/register.tsx`
- Test: `plugin/hooks/pane.test.ts`

**Interfaces:**
- Consumes: `$.ui.open`, `ui.render` `{ component: 'Pane' }`, `render`/`paintModel`.
- Produces: `/ccstatus pane` opens/closes a pane with id `ccstatus` via `$.ui.open({ id: 'ccstatus', title: 'ccstatus' })` and a `paneOpen` atom; a `ui.render` `{ component: 'Pane', requestId: 'ccstatus' }` hook paints the `pane` surface (`render(cfg, snap, { surface: 'pane', width: e.props.bodyColumns })`).

- [ ] **Step 1: Write the failing test** — assert `render(cfg, snap, { surface: 'pane', ... })` yields lines when `surfaces.pane.enabled`, and (via the kit) that mounting `Pane` with requestId `ccstatus` paints them. Concrete pure-render assertion:
```ts
// plugin/hooks/pane.test.ts
import { test, expect } from 'claude-code/testing'
import { render, defaultConfig } from './core.js'
test('pane surface renders when enabled', () => {
  const cfg = { ...defaultConfig, surfaces: { ...defaultConfig.surfaces,
    pane: { enabled: true, lines: defaultConfig.surfaces.band.lines } } }
  const snap: any = { version: 'v', model: 'M', effort: null, cwd: '', repo: false, gitRoot: '', gitBranch: '', gitWorktree: '', added: 0, modified: 0, deleted: 0, ctxTokens: 10, ctxPct: 1, cached: 0, input: 0, output: 0, total: 0, startedAt: 0, cost: null, fivePct: null, fiveReset: null, weekPct: null, weekReset: null, blockReset: null, terminalWidth: 0, now: 0 }
  expect(render(cfg, snap, { surface: 'pane', width: 80 }).lines.length).toBeGreaterThan(0)
})
```
Add a kit mount test for the `Pane` component if supported.

- [ ] **Step 2: Run to verify it fails** — `claude plugin test plugin`.

- [ ] **Step 3: Implement** — add a `paneOpen` atom; extend `command.run { command: 'ccstatus' }` to parse the arg (`e` carries the command args — see `claude-code.d.ts` for the `command.run` input shape) so `ccstatus pane` toggles the pane: `await $.ui.open({ id: 'ccstatus', title: 'ccstatus' })` and track `paneOpen`. Add a `ui.render` hook on `{ component: 'Pane', requestId: 'ccstatus' }` that paints `render(cfg, snap, { surface: 'pane', width: e.props.bodyColumns || 0 })` with `paintModel`.

- [ ] **Step 4: Run to verify it passes** — `claude plugin test plugin` + `claude plugin validate plugin`.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/pane.test.ts
git commit -m "feat(plugin): openable pane surface via /ccstatus pane"
```

---

### Task 8: Toast wiring

**Files:**
- Modify: `plugin/hooks/register.tsx`
- Test: `plugin/hooks/toast-wiring.test.ts`

**Interfaces:**
- Consumes: `dueToasts` (Task 3), `$.ui.toast`, a `toastFired` atom (`Record<string, boolean>`).
- Produces: on each refresh, if `config.surfaces.toasts.enabled`, compute `dueToasts(rules, snap, fired)`; for each due toast call `$.ui.toast(text)` and mark its key fired; clear a `once` key from `fired` when its `evalWhen` goes false (so it can fire again next time the threshold is re-crossed).

- [ ] **Step 1: Write the failing test** — drive two refreshes with a snapshot that crosses `ctxPct>80`; assert `$.ui.toast` is called once for a `once` rule across repeated refreshes while the condition stays true, and again after it drops and re-crosses. Use the kit to capture `$.ui.toast` (mock). Concretely seed `config` with a `once` rule and snapshots `{ctxPct:90}` twice then `{ctxPct:10}` then `{ctxPct:90}`, asserting 2 total toasts.

- [ ] **Step 2: Run to verify it fails** — `claude plugin test plugin`.

- [ ] **Step 3: Implement** — add `toastFired` atom; in `refresh()` after snapshot, evaluate and fire, updating `toastFired` (mark fired keys; delete keys whose `evalWhen` is now false). Guard `$.ui.toast` in try/catch.

- [ ] **Step 4: Run to verify it passes** — `claude plugin test plugin`.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/toast-wiring.test.ts
git commit -m "feat(plugin): fire threshold toasts from toast rules"
```

---

### Task 9: Config live-reload + command subcommands

**Files:**
- Modify: `plugin/hooks/register.tsx`
- Test: `plugin/hooks/reload.test.ts`

**Interfaces:**
- Consumes: `$.fs.stat` (`mtimeMs`), `$.fs.read`, `parseConfig`, `configPath`.
- Produces:
  - On each 2s tick, `$.fs.stat(path)` → if `mtimeMs` changed since the stored `configMtime` atom, re-read + `parseConfig` and update the `config` atom (and `configMtime`).
  - `/ccstatus` subcommand parsing: no arg → toggle band; `pane` → toggle pane (Task 7); `reload` → force re-read config now; `theme <name>` → set `config.theme` and write the file back (`$.fs.write`); `edit` → return text pointing to `npx ccstatus`.

- [ ] **Step 1: Write the failing test** — a pure test for the mtime-change decision helper if extracted, plus a kit test: change the mocked `$.fs` mtime + contents between ticks and assert the `config` atom updates. Also assert `/ccstatus reload` re-reads. Extract a pure helper `shouldReload(prevMtime: number | null, stat: { mtimeMs: number }): boolean` and unit-test it:
```ts
// plugin/hooks/reload.test.ts
import { test, expect } from 'claude-code/testing'
import { shouldReload } from './config-io.js'
test('shouldReload on first stat and on mtime change', () => {
  expect(shouldReload(null, { mtimeMs: 10 })).toBe(true)
  expect(shouldReload(10, { mtimeMs: 10 })).toBe(false)
  expect(shouldReload(10, { mtimeMs: 20 })).toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails** — `claude plugin test plugin`.

- [ ] **Step 3: Implement** — add `shouldReload` to `config-io.ts` (pure); add a `configMtime` atom; in the tick, stat the path and reload when `shouldReload`; extend the `command.run` handler to parse subcommands. Guard all `$.fs` calls.

- [ ] **Step 4: Run to verify it passes** — `claude plugin test plugin` + `claude plugin validate plugin`.

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/register.tsx plugin/hooks/config-io.ts plugin/hooks/reload.test.ts
git commit -m "feat(plugin): live config reload on mtime change and /ccstatus subcommands"
```

---

### Task 10: PluginState contract + final gate

**Files:**
- Create/replace: `plugin/types/index.d.ts`
- Test: (final validate + test + typecheck)

**Interfaces:**
- Produces: the `$.state` contract declaring every atom the plugin uses, so `claude plugin validate` holds the module to it.

- [ ] **Step 1: Write the contract**

```ts
// plugin/types/index.d.ts
import type { Config, Snapshot } from '../hooks/core.js'

declare module 'claude-code' {
  interface PluginState {
    ccstatus: {
      visible: boolean
      paneOpen: boolean
      snapshot: Snapshot | null
      config: Config | null
      effort: string | null
      configMtime: number | null
      toastFired: Record<string, boolean>
    }
  }
}
```
(If importing `Config`/`Snapshot` from the generated `../hooks/core.js` is awkward for the validator, inline the minimal shapes or import from a committed type file. Reconcile against what `claude plugin validate` accepts.)

- [ ] **Step 2: Validate the contract**

Run: `claude plugin validate plugin`
Expected: no errors; every `$.state` key the module uses is in the contract.

- [ ] **Step 3: Final gate — build, validate, test**

Run, all must be clean:
- `npm run build:plugin-core`
- `claude plugin validate plugin`
- `claude plugin test plugin`
- If the mod has been loaded once (types laid under `plugin/.claude-plugin/types/`): `tsc -p plugin`. If not yet loaded, note it; typecheck runs once the plugin loads in a session.

- [ ] **Step 4: Commit**

```bash
git add plugin/types/index.d.ts
git commit -m "feat(plugin): declare PluginState contract and pass final validate/test gate"
```

---

## Deferred (carried, not in this plan)

- **Cost + block timer** remain `null` in the snapshot (no price table / block math yet); the `cost` and `block-timer` widgets omit. A later plan wires real values once the usage API fields are confirmed.
- **Per-project config override** (`./.ccstatus.json`) — spec non-goal for v1.
- **Live in-session hot-reload dev loop** — tests use `claude plugin test`; to iterate live, load the repo `plugin/` via `--plugin-dir` or copy into dev-mods. Documented in Plan 4's README.

## What's next (separate plans)

- **Plan 3 — TUI:** `packages/tui` Ink app (config load/save + live preview via `render` + editor screens + ccstatusline import).
- **Plan 4 — Packaging:** marketplace manifest, npm publish for the TUI, README + demo gif, CI, and the deferred cost/block + attribution-trailer cleanup.
