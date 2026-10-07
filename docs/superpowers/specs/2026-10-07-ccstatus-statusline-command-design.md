# ccstatus — Multicolour Status Line via the Native `statusLine` Command — Design Spec

**Date:** 2026-10-07
**Status:** Draft — pending review
**Author:** sushant@workfabric.com

## Purpose

Make ccstatus's **status line** render in full colour, and fix the **band/pane**
background and bright colours in the mod.

Today both are broken when the mod runs live:

1. **Status line shows raw ANSI.** The mod renders the status-line surface with
   `$.ui.status(toAnsi(render(...)))`. But the engine's `$.ui.status(text)` is a
   **plain-text** surface pinned under the prompt ("control characters are
   refused"), not the native bottom status bar. So the ANSI escapes print as
   literal `␛[36m…` garbage.
2. **Band/pane show no background colour.** `plugin/hooks/paint.tsx` passes core
   colour names straight to the engine's `Text` (`backgroundColor: "bgCyan"`,
   `color: "brightYellow"`). The engine's `Text` **is Ink's**, which wants
   `backgroundColor: "cyan"` and `color: "yellowBright"` — it adds the `bg` and
   reorders `bright` itself. The chalk-style names don't resolve, so backgrounds
   (and bright foregrounds) don't render.

Neither is a regression from the lint/format toolchain PR (that change only
reformatted these files — verified by a whitespace-ignoring diff). Both shipped
in the original build and surfaced the first time the mod was viewed live.

## Background: why the native status line _can_ be multicolour

Claude Code's native status line is a **`settings.json` command**, not the mod's
`$.ui.status`. Per the official docs, it "runs any shell script you configure…
receives JSON session data on stdin and displays whatever your script prints,"
and **ANSI colour escape codes are supported** ("use ANSI escape codes like
`\033[32m` for green"). This is exactly the mechanism
[ccstatusline](https://github.com/sirmalloc/ccstatusline) uses — it writes

```json
"statusLine": { "type": "command", "command": "npx -y ccstatusline@latest", "padding": 0 }
```

to `settings.json` and renders 16/256/truecolour via ANSI.

ccstatus's `core.toAnsi(render(...))` **already produces correct ANSI**
(`packages/core/src/ansi.ts` is sound). It just needs to reach the native status
line through the settings command instead of `$.ui.status`.

This supersedes two earlier assumptions:

- **DEC-0002** — "`toAnsi` serializes for the native status line" is right about
  the format but wrong about the pipe: the consumer is the `settings.json`
  command's stdout, **not** the mod's `$.ui.status`.
- **DEC-0005** — "the mod's own elements accept these [bg-prefixed] names
  directly" is wrong: the mod's elements are Ink's and need the same name mapping
  the TUI already applies.

## Goals

- The ccstatus status line renders in full colour via the native `statusLine`
  command, from the same shared config + snapshot the rest of ccstatus uses.
- The band and pane render background and bright colours correctly in the mod.
- One colour-name mapping, owned by core, used by both hosts (TUI and mod).
- Enabling the status line is a safe, opt-in, reversible TUI action.

## Non-goals (v1)

- Overlaying live fields (cost, model) from the statusLine stdin JSON — snapshot
  is the single data source in v1 (it is richer: it carries rate-limit % and
  context % the stdin JSON lacks). Easy to add later.
- Performance tuning of the command's cold start (npx). We document
  `refreshInterval` and a pinned-path option but do not optimise now.
- A fifth plain-text "under the prompt" surface via `$.ui.status` (considered and
  rejected — the native command owns the status line; `$.ui.status` is removed).

## Architecture & data flow

```
mod (register.tsx)  ── writes ──▶  snapshot.json   ┐
TUI (ccstatus)      ── writes ──▶  config.json     ├─▶ `ccstatus statusline`  (the settings.json command)
                                                   │       reads config.json + snapshot.json
Claude Code ── runs on repaint, stdin JSON ───────▶│       → core.render(surface:'statusline')
                                                   │       → core.toAnsi()
native status line ◀── renders stdout, ANSI ───────┘       → process.stdout
```

- The **mod** keeps gathering data and writing `snapshot.json` (unchanged) and
  keeps painting the **band**, **pane**, and **toasts**. It no longer calls
  `$.ui.status`.
- The **TUI** keeps writing `config.json` and gains the ability to write the
  `statusLine` block into `settings.json`.
- A new **`ccstatus statusline`** subcommand is the bridge: Claude Code runs it,
  it reads the shared files, renders, and prints ANSI.

## Component A — `ccstatus statusline` subcommand

**Bin dispatch.** `packages/tui/src/index.tsx` currently does
`render(<App />)` unconditionally. It becomes an argv dispatch:

```ts
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

Dynamic `import()` keeps Ink/React off the statusline path, so the command starts
fast. (Dynamic import is fine in the TUI package — the static-imports-only rule is
a plugin constraint, not a TUI one.)

**New module `packages/tui/src/statusline-cmd.ts`** (pure, no Ink; unit-testable):

1. Load config via the existing `loadConfigFile()` (rounds through
   `core.loadConfig`, so it never throws).
2. Read the snapshot via the existing `readSnapshot()`.
3. `width = snapshot.terminalWidth` (the statusLine stdin JSON has **no** width
   field; the mod captured it into the snapshot). Fall back to a sane default
   (e.g. 200) if absent.
4. If `config.surfaces.statusline.enabled` is false, or no snapshot is available,
   write nothing and exit 0 (an empty status line).
5. Otherwise `process.stdout.write(toAnsi(render(cfg, snap, { surface: 'statusline', width })))`.

Stdin (the session JSON) is drained but **not required** in v1. Exit code is
always 0 — a status-line command must never error the host.

**Data-source dependency.** The command depends on the mod running to keep
`snapshot.json` fresh. When the mod is not running, `readSnapshot()` falls back to
the bundled sample; the command will render sample data. This is acceptable and
documented — the status line is a surface of the same system; the mod is its data
source (the existing snapshot handoff, DEC-0004).

## Component B — TUI enables the native status line

**New module `packages/tui/src/statusline-setup.ts`** (mirrors `mod-status.ts`:
takes an injected fs/path/runner so tests never touch real files):

- `settingsPath(scope)` → `~/.claude/settings.json` (user) or
  `<cwd>/.claude/settings.json` (project).
- `detectStatusline(scope)` → one of:
  - `'ours'` — a `statusLine.command` that invokes `ccstatus statusline`.
  - `'absent'` — no `statusLine` key.
  - `'other'` — a different `statusLine` (carry its `command` string for display).
  - `'unknown'` — settings unreadable / invalid JSON.
- `enableStatusline(scope)` → merges

  ```json
  { "statusLine": { "type": "command", "command": "npx ccstatus statusline", "padding": 0 } }
  ```

  into the existing settings object (**never** clobbering other keys), writing
  atomically (temp + rename) with a `settings.json.bak`. Returns a result naming
  what happened.

- `disableStatusline(scope)` → removes the `statusLine` key only when it is ours;
  restores nothing else.

**Decisions baked in:**

- **Scope — ask at enable time.** When the user enables the status line, the TUI
  prompts **User (`~/.claude/settings.json`) vs Project
  (`<repo>/.claude/settings.json`)** and writes to the chosen file.
- **Existing statusLine — back up + confirm.** If `detect` returns `'other'`, the
  TUI shows the current command, requires an explicit confirm, writes the `.bak`,
  then replaces. Without confirmation it does nothing.

**UI.** A status-line section (on the Surfaces screen) shows the current state
(`ours` / `absent` / `other: <cmd>` / `unknown`) and binds a keypress to
enable/disable, mirroring the opt-in mod-install pattern (DEC-0011). Detection is
read-only; writes happen only on an explicit keypress + (for scope and for an
existing statusLine) an explicit choice/confirm. Degrades to printed instructions
when files can't be read.

## Component C — mod change

In `plugin/hooks/register.tsx`, remove the `statusline` branch from
`applySurfaces` (the `$.ui.status(toAnsi(...))` call and the matching
`$.ui.status(undefined)`). The mod keeps band + pane + toasts + `snapshot.json`.
Regenerate `plugin/hooks/core.{js,d.ts}` (no core-API change here, but the build
stays in sync). `applySurfaces` is renamed/trimmed to reflect it now only fires
toasts.

## Component D — band/pane background & bright colours

Move the colour-name mapping into **core** as pure string transforms and export
them (bundled into `core.js`), e.g.:

- `rendererColor(name?)` — `brightYellow → yellowBright`, base names unchanged.
- `rendererBg(name?)` — strip `bg` then apply `rendererColor`: `bgCyan → cyan`,
  `bgBrightYellow → yellowBright`. Keep the `brightGray`/`bgBrightGray` exception
  (Ink has no `grayBright`; those stay effectively uncoloured, as today).

Apply them in both hosts:

- `packages/tui/src/paint.tsx` — replace the local `inkColor`/`inkBg` with core's
  (single source of truth; the TUI preview is unchanged because the mapping is the
  same).
- `plugin/hooks/paint.tsx` — `color={rendererColor(seg.fg)}`,
  `backgroundColor={rendererBg(seg.bg)}`.

Regenerate the bundle.

Because the engine's `Text` is Ink's, one mapping serves both hosts — which is why
it belongs in core (DEC-0002: core owns how the bar looks).

## Config / schema

No schema change. `surfaces.statusline.enabled` keeps its meaning (the command
prints nothing when false). The `statusLine` _settings.json_ block is separate
from ccstatus's own `config.json` and is managed only by the TUI setup module.

## Testing

- **`statusline-cmd`** — unit tests: config+snapshot → expected ANSI string;
  `enabled:false` → empty; missing snapshot → empty; width taken from snapshot.
- **`statusline-setup`** — unit tests with injected fs: merge preserves unrelated
  settings keys; `.bak` written; `detect` returns ours/absent/other/unknown
  correctly; user vs project path; disable only removes ours.
- **`rendererColor`/`rendererBg`** — core unit tests incl. the `brightGray`
  exception and the `bg`/`bright` transforms.
- **Mod** — the pure modules stay covered; engine-integration tests still require
  the preview `claude` build (unchanged).
- **Visual** — cannot be verified in CI or this environment (needs the preview
  engine). The author confirms the live render after `/reload-plugins` and
  enabling the status line.

## Documentation impact (same change)

- **New DEC** — "Status line is rendered by a native `settings.json` command, not
  the mod"; supersede/correct **DEC-0002** (the pipe) and **DEC-0005** (mod
  elements are Ink; colour mapping required). Record the `$.ui.status` removal and
  the shared core colour mapping.
- **New FLOW** — the statusLine-command render path (Claude Code → `ccstatus
statusline` → config.json + snapshot.json → render/toAnsi → stdout) and the TUI
  settings-write flow (scope prompt, backup+confirm).
- **CLAUDE.md** — correct the colour-name gotcha (the mod needs the same mapping
  as the TUI), note the new `ccstatus statusline` command and the TUI's
  settings.json integration, and that the mod no longer uses `$.ui.status`.

## Risks & mitigations

- **Writing the user's `settings.json`** is sensitive → merge (never overwrite the
  file), atomic temp+rename, `.bak`, explicit confirm for an existing statusLine,
  and read-back validation. Never touch keys other than `statusLine`.
- **Cold-start latency** of `npx ccstatus statusline` per repaint → document
  `refreshInterval` (Claude Code ≥ 2.1.97) and a pinned global/`node` path option;
  not optimised in v1.
- **Stale status line when the mod is off** → documented dependency; the command
  renders the bundled sample, consistent with the TUI preview's fallback.

## Rollout

Single feature branch → PR. Components A–D plus docs land together so the status
line and band are coherent in one change; the bundle is regenerated and committed
(drift check stays green).
