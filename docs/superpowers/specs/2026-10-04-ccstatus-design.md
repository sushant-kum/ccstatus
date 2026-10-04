# ccstatus — Design Spec

**Date:** 2026-10-04
**Status:** Approved for planning
**Author:** sushant@workfabric.com (with Claude)

## Purpose

`ccstatus` is a configurable, feature-rich status bar for Claude Code, built on
the Claude Code **mod/plugin UI system** rather than the native single-line
`statusLine`. It is to the mod system what
[ccstatusline](https://github.com/sirmalloc/ccstatusline) is to the native
status line: a composable set of widgets, colors, themes, powerline styling, and
multi-line layouts, driven by a shared config and editable through an
interactive configurator.

Because it renders through the mod system, `ccstatus` is richer than the native
status line: it can draw a full-width **multi-line band above the prompt**, an
openable **pane/sidebar**, the **native status line**, and threshold **toasts** —
all from one config.

### Why this exists

The author already hand-built `ccstatusline-band`, a mod that reproduces
ccstatusline's *data* as a fixed 4×4 powerline grid above the prompt. It is not
configurable. `ccstatus` generalizes that into a config-driven, feature-complete,
publishable project.

## Goals

- Port as many ccstatusline features as possible onto the mod system.
- One config drives four surfaces: above-prompt band, native status line,
  pane/sidebar, and toasts.
- Two ways to configure: a standalone `npx ccstatus` Ink TUI (primary editor)
  and in-session `/ccstatus` quick toggles.
- Public from day one: npm package for the TUI, marketplace entry for the mod,
  docs, MIT license.
- The TUI's live preview must match the live bar exactly.

### Non-goals (v1)

- Per-project config overrides (deferred; XDG global config only in v1).
- A web-based configurator.
- Priority-based widget dropping / responsive breakpoints beyond simple
  truncation (deferred).
- Publishing `@ccstatus/core` as its own npm package (internal workspace package
  only; consumed by the TUI and synced into the plugin).

## Decisions (from brainstorming)

| Question | Decision |
| --- | --- |
| Primary deliverable | Config-driven mod **+** configurator (closest analog to ccstatusline). |
| Configurator UX | **Both**: standalone `npx ccstatus` TUI (primary) + in-session `/ccstatus` quick toggles. |
| Render surfaces | **All four**: above-prompt band, native status line, pane/sidebar, toasts. |
| Widget scope (v1) | **All**: core data, git, cost & usage limits, custom (text/command/flex). |
| Styling scope (v1) | **All**: per-item colors + themes, powerline separators, multi-line + merge/align, per-surface layout. |
| Distribution | **Public from day one** (npm + marketplace + docs). |
| Name | `ccstatus` (free on npm + GitHub; matches the existing `/ccstatus` command; `ccbar` was saturated ~8× in this niche). |
| Architecture | **A — shared pure core + thin painters.** |

## Architecture

Shared pure **core** emits a surface-agnostic render model; the **mod** and the
**TUI** each paint it with their own element source. This keeps zero duplication
of widget/layout logic and guarantees the TUI preview matches the live bar.

### Repository layout

Public monorepo using npm workspaces:

```
ccstatus/
├─ package.json                      # workspaces root
├─ README.md
├─ LICENSE                           # MIT
├─ .claude-plugin/
│  └─ marketplace.json               # marketplace entry pointing at ./plugin
├─ packages/
│  ├─ core/                          # @ccstatus/core — PURE TS (no claude-code, no ink)
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ snapshot.ts              # Snapshot type (data inputs)
│  │     ├─ render-model.ts          # RenderModel / Segment types (output)
│  │     ├─ config/                  # schema, defaults, validation, migration, ccstatusline import
│  │     ├─ widgets/                 # widget registry + per-widget formatters
│  │     ├─ layout/                  # layout engine: cells, merge, align, flex, truncate
│  │     ├─ powerline/               # separator/cap composition
│  │     ├─ theme/                   # themes + color resolution
│  │     ├─ ansi.ts                  # RenderModel -> ANSI string (for native status line)
│  │     └─ index.ts
│  └─ tui/                           # ccstatus — Ink TUI, published npm bin `ccstatus`
│     ├─ package.json                # bin: { "ccstatus": "..." }
│     └─ src/
│        ├─ app.tsx
│        ├─ screens/                 # items, colors, themes, powerline, surfaces, defaults
│        ├─ preview.tsx              # paints RenderModel via Ink
│        ├─ import-ccstatusline.ts
│        └─ sample-snapshot.ts
└─ plugin/                           # the Claude Code mod (publishable)
   ├─ .claude-plugin/plugin.json     # { name: "ccstatus", version, description, types }
   ├─ hooks/
   │  ├─ hooks.json                  # { "modules": ["./register.tsx"] }
   │  ├─ register.tsx                # hooks: session.start, turn.complete, tool.call, command.run, ui.render
   │  ├─ collect.ts                  # Snapshot collection ($.session, git via $.process)
   │  ├─ config-io.ts               # read config via $.fs, mtime cache + reload
   │  ├─ paint.tsx                   # RenderModel -> $.ui.resolve elements
   │  └─ core/                       # SYNCED copy of packages/core/src (generated; gitignored)
   └─ types/index.d.ts              # PluginState contract
```

### Core sharing mechanism

The mod's module environment resolves **relative file imports inside the plugin
folder** (files with loadable suffixes), not `node_modules`. Therefore:

- `packages/core/src` is **canonical**.
- A build/watch step **syncs** `packages/core/src/**` → `plugin/hooks/core/**`
  (plain `.ts`, loadable suffixes), so the mod imports core relatively and
  hot-reload keeps working. `plugin/hooks/core/` is generated and gitignored.
- The TUI consumes `@ccstatus/core` normally (bundled at build time).

Core must stay free of any `claude-code` or `ink` imports so the same files work
in both hosts.

## Data flow

```
$.session + git ──► Snapshot ─┐
                              ├─► core.render(config, snapshot, width) ─► RenderModel ─► painter ─► surface
config.json (via $.fs) ───────┘        (pure)                          (segments)   (per host)
```

### Snapshot (data inputs)

Extends the existing `ccstatusline-band` snapshot:

```ts
type Snapshot = {
  version: string
  model: string
  effort: string | null
  cwd: string
  repo: boolean
  gitRoot: string
  gitBranch: string
  gitWorktree: string
  added: number; modified: number; deleted: number
  ctxTokens: number; ctxPct: number
  cached: number; input: number; output: number; total: number
  startedAt: number
  cost: number | null            // best-effort (from token counts; null if unavailable)
  fivePct: number | null; fiveReset: string | null
  weekPct: number | null; weekReset: string | null
  blockReset: string | null      // block/burn timer (best-effort)
  terminalWidth: number          // bodyColumns at render time
  now: number
}
```

Cost is best-effort: computed in core from token counts (and an optional price
table), `null` when not derivable. Block/burn timer is best-effort from usage
data.

### RenderModel (core output)

```ts
type Segment = {
  text: string
  fg?: string            // named terminal color
  bg?: string            // named terminal background color
  kind: 'cell' | 'separator' | 'cap' | 'flex'
}
type RenderLine = { segments: Segment[] }
type RenderModel = { lines: RenderLine[] }
```

Painters map each segment to their element source:
- **mod**: `const { Box, Text } = $.ui.resolve(e)` → `<Text color={fg} backgroundColor={bg}>`.
- **TUI**: Ink `<Text color bg>`.
- **native status line**: `ansi.ts` serializes RenderModel → an ANSI-colored
  single-line string for `$.ui.status(string)`.

## Config

Location: `$XDG_CONFIG_HOME/ccstatus/config.json` (default
`~/.config/ccstatus/config.json`). Written by the TUI, read by the mod via
`$.fs`. Per-project override deferred to a later version.

Keyed per surface; item shape stays close to ccstatusline's so existing
ccstatusline configs can be imported.

```jsonc
{
  "version": 1,
  "theme": "default",
  "themes": { "default": { /* per-widget default fg/bg */ } },
  "defaults": { "separator": "powerline", "padding": 1, "align": "left" },
  "surfaces": {
    "band":       { "enabled": true,  "lines": [[ /* items */ ]] },
    "statusline": { "enabled": false, "lines": [[ /* items */ ]] },
    "pane":       { "enabled": false, "lines": [[ /* items */ ]] },
    "toasts":     { "enabled": true,  "rules": [
      { "when": "ctxPct>80", "text": "Context over 80%", "once": true }
    ]}
  }
}
```

### Item (widget instance)

```jsonc
{
  "id": "uuid",
  "type": "model",            // see widget types below
  "fg": "white",
  "bg": "bgRed",
  "merge": false,             // merge into previous cell (no separator between)
  "align": "left",            // left | center | right
  "rawValue": false,          // raw value vs labeled
  "metadata": { }             // widget-specific (custom text content, command, format)
}
```

### Widget types (all v1)

- Core data: `model`, `version`, `context-length`, `context-percentage`,
  `tokens-input`, `tokens-output`, `tokens-cached`, `tokens-total`,
  `session-clock`, `cwd`.
- Git: `git-branch`, `git-changes`, `git-worktree`, `git-root-dir`.
- Cost & usage: `cost`, `rate-limit-5h`, `rate-limit-week`, `block-timer`.
- Custom: `custom-text`, `custom-command`, `flex-separator`.

## Core internals

- **Widget registry**: each widget is
  `{ type, label, format(snapshot, item) => string | null }`. `null` means omit
  (e.g. git widgets when not in a repo). The TUI reads the registry to build its
  "add item" menu.
- **Layout engine**: resolve items → cells, drop nulls, apply `merge`,
  distribute `flex-separator` gaps across leftover width, apply padding/align,
  truncate when over width (v1: simple truncation; priority dropping deferred).
- **Powerline**: insert separator glyph segments `fg = prevBg, bg = nextBg` plus
  start/end caps (mirrors the existing band's `▒`). Non-powerline mode uses plain
  spacing/separator strings.
- **Theme/color**: named terminal colors (`red`, `bgRed`, `bgBrightYellow`, …);
  a theme supplies per-widget-type default fg/bg; items override per instance.

## The mod (plugin)

Seeded from the existing `ccstatusline-band` mod.

- `session.start`: register `/ccstatus`; load config; take first snapshot; start
  `$.clock.every(2000)` to refresh the snapshot **and** reload config when its
  mtime changes.
- `turn.complete` / `tool.call`: capture effort; refresh snapshot.
- `ui.render`:
  - `{ component: 'AbovePrompt' }` → band surface (if enabled + visible), sized to
    `e.props.bodyColumns`.
  - `{ component: 'Pane', requestId: <ours> }` → pane surface.
- Native status line: `$.ui.status(ansiString)` updated on refresh (core →
  ANSI). Status is a string, so styling is via embedded ANSI; this is a known
  constraint of that surface.
- Toasts: evaluate `toasts.rules` against the snapshot on refresh; fire
  `$.ui.toast(text)` with `once`/debounce tracked in `$.state`.
- `/ccstatus` subcommands: no arg = toggle band visibility; `pane` =
  open/close pane; `reload` = re-read config; `theme <name>` = quick switch
  (writes config); `edit` = point the user at `npx ccstatus`.

### PluginState contract (`plugin/types/index.d.ts`)

Holds at least: `visible` (band), `paneOpen`, `snapshot`, `effort`, `config`
(last-loaded), `configMtime`, and toast debounce bookkeeping.

## The TUI (`npx ccstatus`)

Ink app. Screens:

1. Main menu.
2. **Items** editor (per surface, per line): add / remove / reorder / edit item,
   set fg/bg, merge, raw value, align, widget `metadata`.
3. **Themes**: create/select/edit named themes.
4. **Powerline / separators**: toggle powerline, separator glyph, caps.
5. **Surfaces**: enable/disable each surface; per-surface layout.
6. **Defaults**: global separator/padding/align.
7. **Preview**: live, using `sample-snapshot` through the same core, painted with
   Ink (guarantees parity with the live bar).
8. **Import from ccstatusline**: read an existing ccstatusline config and map it
   into a `ccstatus` config.

Saves are atomic (temp file + rename) with a backup of the previous config.
Published as the npm bin `ccstatus`.

## Error handling

- **Mod**: bad/missing config → keep last good config, emit a dim log line, never
  crash the session. Git/usage failures → graceful nulls (as the existing mod
  does). An invalid render tree → the engine draws its own (per the engine
  contract).
- **Core**: validate + migrate config (zod), fill defaults, drop invalid items
  with recorded warnings. Never throw on user config; coerce or default.
- **TUI**: inline validation; atomic write + prior-config backup.

## Testing (TDD throughout)

- **core** (pure, high coverage): widget formatters; layout (merge, flex,
  truncate, align, padding); powerline composition; theme/color resolution;
  config validate/migrate; ccstatusline import; ANSI serialization.
- **plugin** (`claude plugin test`, run across `['terminal','desktop']`):
  band and pane mounted and asserted by key; snapshot collection with mocked
  `$.session` / `$.process`; config mtime reload; toast rule firing/debounce;
  `/ccstatus` command toggles.
- **TUI** (ink-testing-library): screen interactions; preview parity (preview
  RenderModel equals core output for the same inputs).

## Distribution

- npm workspaces monorepo.
- `ccstatus` (the TUI) published to npm → `npx ccstatus`.
- The mod published via a Claude Code marketplace: `.claude-plugin/marketplace.json`
  at repo root lists the `plugin/` entry; users run
  `claude plugin marketplace add <repo>` then install.
- MIT license. README with install for both halves + a demo gif. CI
  (lint/test/build) added later.

## Build sequence (feeds the implementation plan)

1. Monorepo scaffold + core skeleton: `Snapshot`, `RenderModel`, config schema,
   validation, defaults.
2. Core heart: widget registry (all v1 widgets) + layout engine + powerline +
   theme → `RenderModel`, with heavy unit tests. (Both hosts depend on this.)
3. Plugin: snapshot collection (port existing mod) + config-io/reload + band +
   `/ccstatus`; then native status line, pane, toasts. Tests via
   `claude plugin test`.
4. TUI: config load/save + preview (core) first; then editor screens; then
   ccstatusline import.
5. Packaging: marketplace manifest, npm publish config, README, license.

## Open questions / risks

- **`$.session.usage` shape for cost and block timer**: confirm during
  implementation what fields are available; cost and block-timer are specified as
  best-effort / nullable until verified against the live API in `types/claude-code.d.ts`.
- **Core-sync dev loop**: the sync-into-plugin step plus the engine's hot-reload
  watcher is two chained watchers; validate the dev ergonomics early and simplify
  if it is fragile.
- **Native status line styling**: limited to ANSI within a string; confirm what
  `$.ui.status` accepts.
- **Pane auto-open etiquette**: a pane opened unasked seats from 144 columns;
  plan to open the pane only via `/ccstatus pane` to respect that.
