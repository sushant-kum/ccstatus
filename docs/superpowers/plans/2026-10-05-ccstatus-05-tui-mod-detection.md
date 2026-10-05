# ccstatus — TUI first-run mod detection & opt-in install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `npx ccstatus` runs and the companion mod isn't installed in Claude Code, the TUI tells the user and offers to install it with one keypress — so no one ends up with a configured bar that never appears.

**Architecture:** A new pure-ish module `packages/tui/src/mod-status.ts` shells out to the `claude` CLI (via an injected runner for testability) to (a) detect whether the `ccstatus` mod is installed and (b) run the marketplace-add + install on request. `app.tsx` calls detection asynchronously on mount, shows a banner when the mod is absent or undetectable, and binds a single `i` keypress — active only on the menu screen — to the opt-in install. The TUI never installs anything unprompted.

**Tech Stack:** TypeScript (strict, NodeNext, `verbatimModuleSyntax`), Node `child_process.execFile`, React + Ink, vitest + ink-testing-library.

**Spec:** none — follow-up feature agreed in-session (addresses the two-halves onboarding gap from DEC-0002/DEC-0004). This plan is the design of record; rulings resolve against the decisions below.

## Global Constraints

- **Node floor `>=20`**; the TUI may use Node APIs freely (the no-`node_modules`/static-import rule is the **plugin's**, not the TUI's).
- **TS strict**, `noUncheckedIndexedAccess`, `NodeNext`, `verbatimModuleSyntax`; every local import uses a `.js` extension; type-only imports use `import type`.
- **No AI attribution** in code, files, or commits (DEC-0007).
- **The TUI stays non-destructive by default.** Detection is read-only; the only state-mutating action (install) fires solely from an explicit `i` keypress, never automatically.
- **Detection must never throw or block the UI.** Any failure — `claude` not on `PATH`, non-zero exit, non-JSON output, timeout — resolves to `ModStatus` `'unknown'`; the TUI renders normally regardless.
- **Decisions locked in-session:** detect by shelling out to `claude plugin list --json` (not the snapshot signal); offer to run the install (not hint-only). Marketplace slug `sushant-kum/ccstatus`, plugin id `ccstatus@ccstatus`.

## Review Focus

- **`claude` not on `PATH`** → `execFile` fails with `ENOENT`; detection must resolve `'unknown'` (never reject), and the banner must show manual instructions with no `i` action (install needs `claude` too). Owned by **Task 1** (detect) + **Task 3** (banner branch).
- **`claude plugin list --json` prints non-JSON or a non-array** (warning line, empty output) → `JSON.parse`/shape guard must not throw; resolve `'unknown'`. Owned by **Task 1**.
- **Partial install failure** (marketplace add succeeds, `install` fails, or vice-versa) → the result must name which step failed and `ok:false`, never report success. Owned by **Task 2**.
- **The `i` keypress hijacks typing** → if bound globally, pressing `i` while editing a custom-text/command value or an import path would trigger an install. It must be active only on the `menu` screen. Owned by **Task 3**.
- **"Installed" implies the bar appears instantly** → after a successful install the mod loads only on the next Claude Code start / `/reload-plugins`; the success message must say so. Owned by **Task 2** (message text) + **Task 3** (rendered).

---

### Task 1: `mod-status.ts` — detection

**Files:**
- Create: `packages/tui/src/mod-status.ts`
- Test: `packages/tui/src/mod-status.test.ts`

**Interfaces:**
- Produces: `MARKETPLACE_SLUG`, `PLUGIN_ID`, `MARKETPLACE_NAME` consts; types `ModStatus = 'installed'|'absent'|'unknown'`, `RunResult = { code: number; stdout: string; stderr: string }`, `RunCmd = (argv: string[]) => Promise<RunResult>`; `runCmd: RunCmd` (default execFile runner); `detectModStatus(run?: RunCmd): Promise<ModStatus>`. Task 2 adds `installMod` to the same file; Task 3 consumes `detectModStatus`/`installMod`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/tui/src/mod-status.test.ts
import { expect, test } from 'vitest'
import { detectModStatus, type RunCmd, type RunResult } from './mod-status.js'

const run = (res: Partial<RunResult>): RunCmd => async () => ({ code: 0, stdout: '', stderr: '', ...res })

test('installed when claude plugin list includes a ccstatus@ entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }, { id: 'ccstatus@ccstatus', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('installed')
})
test('absent when the list has no ccstatus entry', async () => {
  const stdout = JSON.stringify([{ id: 'other@mp', enabled: true }])
  expect(await detectModStatus(run({ code: 0, stdout }))).toBe('absent')
})
test('unknown when claude is not on PATH (non-zero exit)', async () => {
  expect(await detectModStatus(run({ code: -1, stderr: 'ENOENT' }))).toBe('unknown')
})
test('unknown when output is not JSON', async () => {
  expect(await detectModStatus(run({ code: 0, stdout: 'not json' }))).toBe('unknown')
})
test('unknown when output is JSON but not an array', async () => {
  expect(await detectModStatus(run({ code: 0, stdout: '{"id":"ccstatus@ccstatus"}' }))).toBe('unknown')
})
test('detection never rejects even if the runner throws', async () => {
  const throwing: RunCmd = async () => { throw new Error('spawn boom') }
  await expect(detectModStatus(throwing)).resolves.toBe('unknown')
})
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npm test -w ccstatus -- mod-status`
Expected: FAIL — `detectModStatus` / `mod-status.js` not found.

- [ ] **Step 3: Implement detection**

```ts
// packages/tui/src/mod-status.ts
import { execFile } from 'node:child_process'

export const MARKETPLACE_SLUG = 'sushant-kum/ccstatus'
export const MARKETPLACE_NAME = 'ccstatus'
export const PLUGIN_ID = 'ccstatus@ccstatus'

export type ModStatus = 'installed' | 'absent' | 'unknown'
export type RunResult = { code: number; stdout: string; stderr: string }
export type RunCmd = (argv: string[]) => Promise<RunResult>

// Default runner: execFile the given binary. Resolves (never rejects) with the
// child's exit code, or -1 when the binary is missing / can't spawn (ENOENT),
// so a missing `claude` on PATH is a normal non-fatal outcome for callers.
export const runCmd: RunCmd = (argv) => new Promise((resolve) => {
  execFile(argv[0]!, argv.slice(1), { timeout: 10_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    const errCode = (err as { code?: unknown } | null)?.code
    const code = typeof errCode === 'number' ? errCode : err ? -1 : 0
    resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
  })
})

// 'installed' | 'absent' | 'unknown'. Any failure to get a clean answer
// (claude missing, non-zero, non-JSON, wrong shape, thrown) is 'unknown'.
export async function detectModStatus(run: RunCmd = runCmd): Promise<ModStatus> {
  let res: RunResult
  try { res = await run(['claude', 'plugin', 'list', '--json']) }
  catch { return 'unknown' }
  if (res.code !== 0) return 'unknown'
  let parsed: unknown
  try { parsed = JSON.parse(res.stdout) } catch { return 'unknown' }
  if (!Array.isArray(parsed)) return 'unknown'
  const found = parsed.some((p) =>
    !!p && typeof p === 'object'
    && typeof (p as { id?: unknown }).id === 'string'
    && (p as { id: string }).id.startsWith('ccstatus@'))
  return found ? 'installed' : 'absent'
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npm test -w ccstatus -- mod-status`
Expected: PASS (6/6).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck -w ccstatus`
Expected: clean.

```bash
git add packages/tui/src/mod-status.ts packages/tui/src/mod-status.test.ts
git commit -m "feat(tui): detect whether the ccstatus mod is installed via claude plugin list"
```

---

### Task 2: `mod-status.ts` — opt-in install

**Files:**
- Modify: `packages/tui/src/mod-status.ts`
- Test: `packages/tui/src/mod-status.test.ts`

**Interfaces:**
- Consumes: `RunCmd`, `MARKETPLACE_SLUG`, `PLUGIN_ID` from Task 1.
- Produces: `InstallResult = { ok: boolean; message: string }`; `installMod(run?: RunCmd): Promise<InstallResult>`. Task 3 consumes `installMod`.

- [ ] **Step 1: Write the failing tests** (append to `mod-status.test.ts`)

```ts
import { installMod } from './mod-status.js'

const seq = (results: Partial<RunResult>[]): RunCmd => {
  let i = 0
  return async () => ({ code: 0, stdout: '', stderr: '', ...(results[i++] ?? {}) })
}

test('install runs marketplace add then install and reports the reload caveat', async () => {
  const r = await installMod(seq([{ code: 0 }, { code: 0 }]))
  expect(r.ok).toBe(true)
  expect(r.message).toMatch(/restart Claude Code|reload/i)
})
test('install reports marketplace-add failure without claiming success', async () => {
  const r = await installMod(seq([{ code: 1, stderr: 'network down' }, { code: 0 }]))
  expect(r.ok).toBe(false)
  expect(r.message).toMatch(/marketplace add failed/i)
})
test('install reports the install-step failure', async () => {
  const r = await installMod(seq([{ code: 0 }, { code: 1, stderr: 'no such plugin' }]))
  expect(r.ok).toBe(false)
  expect(r.message).toMatch(/install failed/i)
})
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npm test -w ccstatus -- mod-status`
Expected: FAIL — `installMod` not exported.

- [ ] **Step 3: Implement install** (append to `mod-status.ts`)

```ts
export type InstallResult = { ok: boolean; message: string }

const firstLine = (s: string): string => s.split('\n').map(l => l.trim()).find(Boolean) ?? ''

// Opt-in only (called from an explicit keypress). Adds the marketplace, then
// installs non-interactively (-y). On success the mod still loads only on the
// next Claude Code start / /reload-plugins — the message says so.
export async function installMod(run: RunCmd = runCmd): Promise<InstallResult> {
  const add = await run(['claude', 'plugin', 'marketplace', 'add', MARKETPLACE_SLUG])
  if (add.code !== 0) return { ok: false, message: `marketplace add failed: ${firstLine(add.stderr || add.stdout) || `exit ${add.code}`}` }
  const inst = await run(['claude', 'plugin', 'install', PLUGIN_ID, '-y'])
  if (inst.code !== 0) return { ok: false, message: `install failed: ${firstLine(inst.stderr || inst.stdout) || `exit ${inst.code}`}` }
  return { ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' }
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npm test -w ccstatus -- mod-status`
Expected: PASS (9/9).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck -w ccstatus`
Expected: clean.

```bash
git add packages/tui/src/mod-status.ts packages/tui/src/mod-status.test.ts
git commit -m "feat(tui): add opt-in installMod (marketplace add + install -y)"
```

---

### Task 3: Wire detection + banner + opt-in keypress into `App`

**Files:**
- Modify: `packages/tui/src/app.tsx`
- Test: `packages/tui/src/app.test.tsx`

**Interfaces:**
- Consumes: `detectModStatus`, `installMod`, `ModStatus`, `InstallResult`, `PLUGIN_ID`, `MARKETPLACE_SLUG` from Tasks 1–2.
- Produces: `App` now accepts an optional `modProbe` prop for injection: `App({ modProbe }?: { modProbe?: { detect: () => Promise<ModStatus>; install: () => Promise<InstallResult> } })`, defaulting to the real functions. Render output gains a mod banner and (on `menu`) an `i`-to-install action.

- [ ] **Step 1: Write the failing tests** (append to `app.test.tsx`)

```ts
import { PLUGIN_ID } from './mod-status.js'

const probe = (status: ModStatus, install?: () => Promise<InstallResult>) => ({
  detect: async () => status,
  install: install ?? (async () => ({ ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' })),
})

test('shows an install banner when the mod is absent', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('absent')}/>)
  await tick()
  expect(lastFrame()).toContain('mod not installed')
  expect(lastFrame()).toContain('press i')
  unmount()
})
test('shows no mod banner when the mod is installed', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('installed')}/>)
  await tick()
  expect(lastFrame()).not.toContain('mod not installed')
  unmount()
})
test('unknown status shows manual instructions and no press-i action', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('unknown')}/>)
  await tick()
  expect(lastFrame()).toContain("couldn't check")
  expect(lastFrame()).not.toContain('press i')
  unmount()
})
test('pressing i on the menu installs the mod and shows the reload message', async () => {
  let called = 0
  const { stdin, lastFrame, unmount } = render(
    <App modProbe={probe('absent', async () => { called++; return { ok: true, message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar' } })}/>)
  await tick()
  stdin.write('i'); await tick(); await tick()
  expect(called).toBe(1)
  expect(lastFrame()).toMatch(/restart Claude Code|reload/i)
  unmount()
})
```

(Add any missing imports at the top of `app.test.tsx`: `import type { ModStatus, InstallResult } from './mod-status.js'`.)

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npm test -w ccstatus -- app`
Expected: FAIL — `App` takes no `modProbe` prop; no banner text.

- [ ] **Step 3: Implement the wiring in `app.tsx`**

Add imports:
```ts
import { useEffect } from 'react'
import { detectModStatus, installMod, MARKETPLACE_SLUG, PLUGIN_ID, type ModStatus, type InstallResult } from './mod-status.js'
```

Change the signature and add state + effect + keypress (inside `App`, before `return`):
```ts
export function App({ modProbe }: { modProbe?: { detect: () => Promise<ModStatus>; install: () => Promise<InstallResult> } } = {}){
  const probe = modProbe ?? { detect: () => detectModStatus(), install: () => installMod() }
  // ...existing useApp/useMemo/useState lines...
  const [modStatus, setModStatus] = useState<ModStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    probe.detect().then((s) => { if (alive) setModStatus(s) }).catch(() => { if (alive) setModStatus('unknown') })
    return () => { alive = false }
  }, [])
```

Extend the existing menu `useInput` (keep the `q` handler) so `i` installs, menu-only:
```ts
  useInput((input) => {
    if (screen !== 'menu') return
    if (input === 'q') { exit(); return }
    if (input === 'i' && modStatus === 'absent' && !installing) {
      setInstalling(true)
      probe.install().then((r) => { setInstallMsg(r.message); if (r.ok) setModStatus('installed') })
        .catch((e) => setInstallMsg(e instanceof Error ? e.message : String(e)))
        .finally(() => setInstalling(false))
    }
  })
```

Add the banner to the render tree (after the `saveError` line, before `<Preview .../>`):
```tsx
    {installMsg
      ? <Text color="green">{installMsg}</Text>
      : modStatus === 'absent'
        ? <Text color="yellow">⚠ ccstatus mod not installed — press i to install ({PLUGIN_ID}){installing ? ' … installing' : ''}</Text>
      : modStatus === 'unknown'
        ? <Text color="yellow">⚠ couldn't check if the mod is installed — if the bar isn't showing, run: claude plugin marketplace add {MARKETPLACE_SLUG} && claude plugin install {PLUGIN_ID}</Text>
        : null}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npm test -w ccstatus -- app`
Expected: PASS (existing app tests + 4 new).

- [ ] **Step 5: Full TUI suite + typecheck, then commit**

Run: `npm test -w ccstatus && npm run typecheck -w ccstatus`
Expected: all pass (56 = prior 52 + 4), typecheck clean.

```bash
git add packages/tui/src/app.tsx packages/tui/src/app.test.tsx
git commit -m "feat(tui): offer to install the mod on first run when it's absent"
```

---

### Task 4: Docs — DEC-0011, FLOW-0005, README, CLAUDE.md

**Files:**
- Modify: `docs/DECISION.md` (DEC-0011 + index row)
- Modify: `docs/FLOW.md` (FLOW-0005 + index row)
- Modify: `README.md` (note the first-run offer)
- Modify: `CLAUDE.md` (TUI now shells out to `claude`)

**Interfaces:**
- Consumes: the behavior built in Tasks 1–3.

- [ ] **Step 1: Add DEC-0011 to `docs/DECISION.md`** (index row + entry)

Index row (after DEC-0010):
```
| DEC-0011 | 2026-10-05 | TUI detects the mod and offers to install it on first run | Accepted | tui |
```

Entry (append at end):
```markdown
---

## DEC-0011 — TUI detects the mod and offers to install it on first run

- **Date:** 2026-10-05
- **Status:** Accepted
- **Scope:** tui
- **Related:** DEC-0002, DEC-0004, DEC-0010, [FLOW-0005](./FLOW.md#flow-0005--tui-first-run-mod-detection--install)

### Context

ccstatus ships as two separately-installed halves sharing one config (DEC-0004).
`npx ccstatus` edits the config but does not install the mod, so a user who runs
only the TUI gets a saved config and no visible bar, with no explanation.

### Decision

On launch the TUI shells out to `claude plugin list --json`; if no `ccstatus@`
entry is present it shows a banner and binds `i` (menu screen only) to run
`claude plugin marketplace add sushant-kum/ccstatus` + `claude plugin install
ccstatus@ccstatus -y`. Detection is read-only; install fires only from the
explicit keypress. Any detection failure (no `claude` on `PATH`, non-zero,
non-JSON) degrades to `'unknown'` — a banner with manual instructions and no
keypress action — and never blocks or crashes the TUI.

### Alternatives considered

- **Snapshot-based detection** (treat absent `snapshot.json` as "not installed")
  — dependency-free, but can't tell installed-but-never-run from not-installed,
  and gives no basis to offer the install; rejected in favor of the authoritative
  `claude plugin list`.
- **Hint only, never run the install** — lowest-risk, but leaves the user to
  copy/paste; rejected in favor of the one-keypress offer.
- **Auto-install without asking** — rejected: the TUI must not mutate the user's
  Claude install unprompted.

### Consequences

- The TUI now depends on the `claude` CLI at runtime for this feature only, and
  degrades gracefully when it is absent (the rest of the TUI is unaffected).
- The install is testable without side effects: `detectModStatus`/`installMod`
  take an injected `RunCmd`; `App` takes an optional `modProbe`.
- A successful install still needs a Claude Code restart / `/reload-plugins`; the
  success message says so.
```

- [ ] **Step 2: Add FLOW-0005 to `docs/FLOW.md`** (index row + entry)

Index row (after FLOW-0004):
```
| FLOW-0005 | TUI first-run mod detection & install   | tui          | 2026-10-05    |
```

Entry (append at end):
```markdown
---

## FLOW-0005 — TUI first-run mod detection & install

- **Scope:** tui
- **Trigger:** `npx ccstatus` launch.
- **Outcome:** when the mod is absent the user is told and can install it with one keypress.
- **Last verified:** 2026-10-05
- **Related:** DEC-0011, [FLOW-0002](#flow-0002--config-edit--shared-file--mod-reload)

### Steps

1. `App` mounts and, in a `useEffect`, calls `detectModStatus()` → `runCmd(['claude','plugin','list','--json'])`.
2. The result sets `modStatus`: `'installed'` (an `id` starts with `ccstatus@`), `'absent'` (list parsed, none), or `'unknown'` (claude missing / non-zero / non-JSON).
3. `'absent'` → yellow banner "mod not installed — press i to install". `i` on the menu screen calls `installMod()` → `marketplace add` then `install … -y`; the green result message (incl. the restart/reload caveat) replaces the banner and, on success, `modStatus` flips to `'installed'`.
4. `'installed'` → no banner. `'unknown'` → banner with manual commands, no `i` action.

### Branches & failure modes

- **`claude` not on `PATH`** → `runCmd` resolves code `-1`; detection `'unknown'`; manual-instructions banner; no install offered (install needs `claude` too).
- **`claude plugin list` non-zero / non-JSON / non-array** → `'unknown'` (never throws).
- **`i` outside the menu screen** → ignored (the handler early-returns unless `screen==='menu'`), so typing `i` in an editor never installs.
- **marketplace-add or install step fails** → `installMod` returns `{ ok:false, message }` naming the failed step; the banner shows it; `modStatus` stays `'absent'`.
```

- [ ] **Step 3: Update `README.md` Install section**

Under "### 2. The configurator", add a sentence:
```markdown
On launch, `npx ccstatus` checks whether the mod is installed; if it isn't, it
shows a banner and offers to install it for you (press `i`). A successful install
takes effect after you restart Claude Code or run `/reload-plugins`.
```

- [ ] **Step 4: Update `CLAUDE.md`**

In the TUI/snapshot-handoff area, add one line: the TUI additionally shells out to the `claude` CLI on launch to detect the mod and (on an explicit keypress) install it — read-only detection, opt-in install, degrades to a manual-instructions banner when `claude` is absent. Cross-link DEC-0011.

- [ ] **Step 5: Verify doc links and commit**

Run:
```bash
grep -q "DEC-0011" docs/DECISION.md && grep -q "FLOW-0005" docs/FLOW.md \
  && grep -q "DEC-0011" CLAUDE.md && grep -q "press \`i\`\|press i" README.md && echo "DOCS-OK"
```
Expected: `DOCS-OK`.

```bash
git add docs/DECISION.md docs/FLOW.md README.md CLAUDE.md
git commit -m "docs: DEC-0011 + FLOW-0005 — TUI first-run mod detection & install"
```

---

## Final verification (run after all tasks)

- [ ] `npm test -w ccstatus` → 56 pass (52 prior + mod-status 9 across files… count may differ; all green).
- [ ] `npm run typecheck -w ccstatus` → clean.
- [ ] `npm run build -w ccstatus` → `dist/index.js` with shebang (the new module bundles in).
- [ ] `npm test -w @ccstatus/core` → 75 pass (unchanged).
- [ ] `claude plugin validate plugin` / `claude plugin test plugin` → unchanged (29 pass) — this feature doesn't touch the mod.
- [ ] Manual smoke (optional): in a dir with no `ccstatus` mod, `node packages/tui/dist/index.js` shows the "mod not installed" banner.
