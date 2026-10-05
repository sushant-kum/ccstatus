# FLOW.md — Flow Catalogue

> **What this is.** The reference for _how_ multi-step behaviour actually runs in this repo — user
> journeys, request/response chains, auth sequences, build and release pipelines. One entry per
> flow, each naming the concrete files that implement it.
>
> **What this is not.** Rationale (that is [DECISION.md](./DECISION.md)) or specs. A flow entry says
> what happens, in order, and what happens when a step fails.
>
> **Conflict rule:** if this document and the source disagree, the source wins — then update the
> affected flow in the same PR.

---

## How to use this file

**Write a flow when any of these is true:**

- Behaviour spans more than one module, app, service, or process.
- Understanding it today requires opening three or more files.
- It has non-obvious failure or fallback branches.
- It crosses a boundary someone else owns (backend contract, CI/CD pipeline, deploy/GitOps repo).

**Do not write a flow for:** a single component's internal state, anything a function's doc comment
already explains, or a sequence that exists only inside one file.

**Rules of the catalogue:**

1. IDs are sequential (`FLOW-0001`, `FLOW-0002`, …) and never reused.
2. Every flow gets a row in the index table below, in the same PR.
3. Unlike DECISION.md, flow entries are **living documents** — edit a flow in place when the
   behaviour changes, and update its `Last verified` date. Delete a flow only when the behaviour is
   gone, and record the removal as a `DEC-XXXX` entry.
4. Always list the **source files** that implement the flow — the entry is worthless once it drifts,
   and the file list is what makes drift checkable.
5. Diagrams are optional; use a fenced `mermaid` block when the branching is hard to read as
   prose. Numbered steps are mandatory.
6. Cross-link freely: `FLOW-0002`, `DEC-0001`, other doc sections.

---

## Index

| ID        | Title                                   | Scope        | Last verified |
| --------- | --------------------------------------- | ------------ | ------------- |
| FLOW-0001 | Mod renders the above-prompt band       | plugin       | 2026-10-04    |
| FLOW-0002 | Config edit → shared file → mod reload  | tui \| plugin | 2026-10-04    |
| FLOW-0003 | Bundle core into the plugin             | repo-wide    | 2026-10-04    |
| FLOW-0004 | Release & distribution                  | repo-wide    | 2026-10-05    |

---

## Entry template

Copy this block verbatim for a new flow.

```markdown
## FLOW-XXXX — <Short noun-phrase title>

- **Scope:** repo-wide | core | plugin | tui
- **Trigger:** what starts the flow (a user action, a route match, a request, a pushed tag, a timer).
- **Outcome:** the successful end state.
- **Last verified:** YYYY-MM-DD
- **Related:** DEC-XXXX, FLOW-XXXX

### Participants

| Piece  | File / endpoint | Role         |
| ------ | --------------- | ------------ |
| <name> | `path/to/file`  | what it does |

### Steps

1. …
2. …

### Branches & failure modes

- **<Condition>** → what happens instead.

### Notes

Anything a reader would otherwise get wrong — ordering constraints, dev-vs-prod differences,
cross-service assumptions.
```

---

## FLOW-0001 — Mod renders the above-prompt band

- **Scope:** plugin
- **Trigger:** session start, then every 2s tick, and every `turn.complete`; `tool.call` captures the
  thinking-effort only (it does not refresh). The engine also calls the `ui.render` hook whenever it
  paints the `AbovePrompt` site.
- **Outcome:** the configured band is painted above the prompt from a fresh snapshot.
- **Last verified:** 2026-10-04
- **Related:** DEC-0001, [FLOW-0002](#flow-0002--config-edit--shared-file--mod-reload)

### Participants

| Piece              | File / endpoint                      | Role                                                        |
| ------------------ | ------------------------------------ | ---------------------------------------------------------- |
| register           | `plugin/hooks/register.tsx`          | hooks: session.start, clock tick, turn/tool, command, render |
| config I/O         | `plugin/hooks/config-io.ts`          | `configPath`, `parseConfig`, `snapshotPath`, `shouldReload` |
| git parse          | `plugin/hooks/git-parse.ts`          | `parseGit` — tab-delimited git output → fields              |
| snapshot build     | `plugin/hooks/snapshot-build.ts`     | `buildSnapshot` — raw `$`/git values → `Snapshot` (pure)    |
| paint              | `plugin/hooks/paint.tsx`             | `paintModel` — `RenderModel` → `$.ui.resolve` elements      |
| bundled core       | `plugin/hooks/core.js` (generated)   | `render` / `loadConfig` (see [FLOW-0003](#flow-0003--bundle-core-into-the-plugin)) |

### Steps

1. `session.start` registers the `/ccstatus` command, loads config from disk
   (`configPath` built from `$.env.get('HOME'/'XDG_CONFIG_HOME')` → `$.fs.read` → `parseConfig`),
   takes a first snapshot, and starts `$.clock.every(2000, …)`.
2. Each tick (and each `turn.complete`) runs `refresh($)`: a re-entrancy-guarded
   function that gathers `version`/`model`/`cwd`/`usage` via `$.session.*` and git fields via
   `$.process.run(<git script>)` → `parseGit`, assembles them with `buildSnapshot`, and writes the
   `snapshot` atom. `tool.call` and `turn.complete` both first capture the thinking-effort into the
   `effort` atom; only `turn.complete` then calls `refresh`.
3. `refresh` also persists the snapshot JSON to `snapshotPath` (for the TUI preview — see FLOW-0002)
   and applies the status-line surface (`$.ui.status(toAnsi(render(...)))`, rendered at
   `snap.terminalWidth || 200`; `terminalWidth` is currently always `0`, so the status line uses the
   fixed 200-column fallback — deferred) and toast rules.
4. When the engine paints the prompt it calls the `ui.render` hook for `{ component: 'AbovePrompt' }`.
   The hook reads the `visible`, `config`, and `snapshot` atoms, calls
   `render(config, snapshot, { surface: 'band', width: e.props.bodyColumns })`, and returns
   `paintModel(model)`.

### Branches & failure modes

- **`e.props.hasSurvey`, band hidden (`visible` false), or missing `config`/`snapshot`** → the render
  hook returns `next(e)` (the engine draws its own; the band is absent).
- **`e.props.bodyColumns` is `0`/undefined (not yet measured)** → the band hook returns `next(e)`
  before calling `render`, so it waits a frame rather than painting at width 0. (For reference, `render`
  at width 0 returns a single line with empty segments, not an empty model.)
- **`render` produces zero lines** → `next(e)`.
- **Any `$` call fails** (`$.session.*`, git `$.process.run`, `$.fs`) → caught; the field degrades to a
  default/null and the last good snapshot is kept. No hook ever throws.

### Notes

The 2s tick is registered once at `session.start` via `$.clock.every(2000, …)`. `buildSnapshot`
currently sets `cost` and `blockReset` to `null` (best-effort, deferred), so the `cost` and
`block-timer` widgets omit. When `parseConfig` reports warnings (invalid JSON, dropped items, stripped
colors), `reloadConfig` surfaces a one-shot `$.ui.toast` so a rejected/degraded config is observable
rather than silently falling back to defaults.

---

## FLOW-0002 — Config edit → shared file → mod reload

- **Scope:** tui | plugin
- **Trigger:** the user edits and saves config in `npx ccstatus` (or hand-edits
  `~/.config/ccstatus/config.json`).
- **Outcome:** the running mod picks up the new config and repaints within one tick.
- **Last verified:** 2026-10-04
- **Related:** DEC-0001, [FLOW-0001](#flow-0001--mod-renders-the-above-prompt-band)

### Participants

| Piece          | File / endpoint                      | Role                                                       |
| -------------- | ------------------------------------ | --------------------------------------------------------- |
| TUI app        | `packages/tui/src/app.tsx`           | holds config state; Save → `saveConfigFile`               |
| TUI screens    | `packages/tui/src/screens/*.tsx`     | call `setConfig` with an immutably-updated config          |
| config store   | `packages/tui/src/config-store.ts`   | `configPath`, `loadConfigFile`, `saveConfigFile` (atomic)  |
| core validate  | `packages/core/src/config/validate.ts` | `loadConfig` — validate/migrate/default, never throws     |
| mod register   | `plugin/hooks/register.tsx`          | tick-time `reloadConfig` via mtime                         |
| mod config I/O | `plugin/hooks/config-io.ts`          | `shouldReload(prevMtime, stat)`, `parseConfig`             |
| shared file    | `~/.config/ccstatus/config.json`     | the single source both sides read/write                    |

### Steps

1. In the TUI, a screen calls `setConfig` with a cloned, updated `Config` (screens never mutate in
   place). The pinned preview re-renders live via `core.render`.
2. On **Save**, `saveConfigFile(configPath(), config)` rounds the config through `core.loadConfig`
   first (so only a valid config is written), copies any existing file to `config.json.bak`, writes a
   `.tmp` file, then `rename`s it over `config.json` (atomic). It returns the re-validation warnings;
   the app shows them after save and only exits when the write succeeded.
3. The running mod, on each 2s tick, calls `reloadConfig`: `$.fs.stat(path)` → `shouldReload` compares
   `mtimeMs` to the stored `configMtime` atom; on change it re-reads + `parseConfig` and updates the
   `config` atom.
4. The next `refresh` + `ui.render` (FLOW-0001) repaints with the new config.

### Branches & failure modes

- **File missing / unreadable / invalid JSON** → `loadConfigFile` (TUI) and `parseConfig` (mod) both
  fall back to `defaultConfig` (both return warnings); neither throws. The TUI shows a startup banner
  when the existing config was invalid (so a following Save is an informed overwrite); the mod surfaces
  a one-shot toast on reload when warnings are present (see FLOW-0001 Notes).
- **`saveConfigFile` I/O error** → the write is atomic, so `config.json` is never left corrupt and the
  prior `.bak` remains; the error is caught and shown in the TUI, which stays open instead of exiting.
- **`/ccstatus theme <name>`** is a second config writer (mod side). It backs the current file up to
  `config.json.bak`, writes a `.tmp`, then renames it over `config.json` via `$.process.run(['mv','-f',…])`
  — atomic, matching the TUI's temp+rename. The sandbox `$.fs` has no `rename`, so the move shells out
  through the same `$.process.run` the git snapshot uses (rename within one directory is atomic). A
  non-zero `mv` exit (or any thrown error) is caught and reported as "could not save the config file"; the
  in-memory `config` atom is already updated, so the live bar still reflects the new theme. See DEC-0009.
- **mtime unchanged** → `reloadConfig` is a no-op (cheap `stat` only).
- **`/ccstatus reload`** forces an immediate re-read regardless of mtime.

### Notes

Config path is `$XDG_CONFIG_HOME/ccstatus/config.json`, else `~/.config/ccstatus/config.json` — the
same resolution on both sides. The TUI also reads the mod-written `snapshot.json` beside it to preview
with real numbers (else a bundled sample).

---

## FLOW-0003 — Bundle core into the plugin

- **Scope:** repo-wide
- **Trigger:** `npm run build:plugin-core` (run after any change to `@ccstatus/core`), and the TUI
  build (`npm run build -w @ccstatus/tui`).
- **Outcome:** the mod and the `ccstatus` bin each carry a self-contained copy of core with zod
  inlined.
- **Last verified:** 2026-10-04
- **Related:** DEC-0001, [FLOW-0001](#flow-0001--mod-renders-the-above-prompt-band)

### Participants

| Piece            | File / endpoint                    | Role                                                    |
| ---------------- | ---------------------------------- | ------------------------------------------------------ |
| root script      | `package.json` (`build:plugin-core`) | tsup entry that bundles core into the plugin           |
| core entry       | `packages/core/src/index.ts`       | the public API surface that gets bundled                |
| plugin bundle    | `plugin/hooks/core.js` + `core.d.ts` | GENERATED, gitignored; imported by the mod as `./core.js` |
| tui build config | `packages/tui/tsup.config.ts`      | `noExternal: ['@ccstatus/core']` bundles core into the bin |

### Steps

1. `npm run build:plugin-core` runs tsup with `--entry.core=packages/core/src/index.ts --format esm
   --dts --out-dir plugin/hooks`, producing `plugin/hooks/core.js` + `core.d.ts` with zod inlined.
2. The mod's modules import from `./core.js` (values) and `import type … from './core.js'` (types).
   Pure modules import **only** `./core.js`; `register.tsx` / `paint.tsx` additionally import
   `claude-code`.
3. `npm run build -w @ccstatus/tui` bundles its own copy of core into `packages/tui/dist/index.js`
   (the `ccstatus` bin) via `noExternal`.

### Branches & failure modes

- **Core changed but `build:plugin-core` not re-run** → the mod runs a stale core; `claude plugin
  test plugin` exercises the bundle, so this surfaces there. Always rebuild after a core change.
- **An `import` from `node_modules` added to a bundled-and-shipped core path** → fine for the TUI
  (normal Node), but the mod sandbox has no `node_modules`, so any such dependency must be bundled
  (as zod is) or it fails to load in the mod.

### Notes

`plugin/hooks/core.js` and `core.d.ts` are generated artifacts — never hand-edit them; edit
`packages/core/src/**` and rebuild. They are **committed** (so git/marketplace installs can load the
mod) but still generated: CI rebuilds and fails on any diff, keeping them in sync with `@ccstatus/core`.
See [DEC-0010](./DECISION.md#dec-0010--distribution-unscoped-ccstatus-bin-private-bundled-core-committed-plugin-bundle) and [FLOW-0004](#flow-0004--release--distribution).

---

## FLOW-0004 — Release & distribution

- **Scope:** repo-wide
- **Trigger:** cutting a public release of ccstatus (manual; not automated in v1).
- **Outcome:** `npx ccstatus` installs the TUI from npm; `claude plugin marketplace add sushant-kum/ccstatus` + install adds the mod.
- **Last verified:** 2026-10-05
- **Related:** DEC-0010, [FLOW-0003](#flow-0003--bundle-core-into-the-plugin)

### Steps

1. Ensure the core bundle is current: `npm run build:plugin-core` (CI also gates
   this via `git diff --exit-code`). Commit if it changed.
2. Verify green: `npm test -w @ccstatus/core`, `npm test -w ccstatus`,
   `npm run build -w ccstatus`, `claude plugin validate plugin`,
   `claude plugin test plugin`.
3. **TUI → npm:** bump `packages/tui/package.json` `version`, then
   `npm publish -w ccstatus` (the package is unscoped + `publishConfig.access:
   public`; core is bundled, so no private dependency is fetched). Requires npm
   auth — **not performed in Phase 4.**
4. **Mod → marketplace:** bump the `version` in `plugin/.claude-plugin/plugin.json`
   and `.claude-plugin/marketplace.json`, tag/release the repo. Users then run
   `claude plugin marketplace add sushant-kum/ccstatus` and
   `claude plugin install ccstatus@ccstatus`. The committed `plugin/hooks/core.js`
   makes the installed mod loadable. **Not performed in Phase 4.**

### Branches & failure modes

- **Published `ccstatus` can't resolve `@ccstatus/core`** → core was left in
  `dependencies`; it must be bundled and in `devDependencies` only (DEC-0010).
- **Installed mod fails to load (`./core.js` missing)** → the bundle wasn't
  committed / went stale; rebuild and commit (CI drift check guards this).
- **`npm pack` ships `src/`** → `files` must be `["dist", "README.md"]`.
