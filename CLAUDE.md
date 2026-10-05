# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Always read [docs/DECISION.md](./docs/DECISION.md) and [docs/FLOW.md](./docs/FLOW.md) before changing
> architecture, conventions, dependencies, or any documented flow — and write back to them in the same change.

## What this is

`ccstatus` is a configurable status bar for Claude Code — the mod-system analog of
[ccstatusline](https://github.com/sirmalloc/ccstatusline). One JSON config drives four surfaces (above-prompt
band, native status line, pane, threshold toasts), edited with an interactive TUI and rendered live by a mod.

npm-workspaces monorepo, three units:
- **`packages/core`** (`@ccstatus/core`, private) — pure TS + zod. The single source of truth for *how the bar looks*.
- **`plugin/`** — the `ccstatus` Claude Code mod (plugin of function hooks). Publishable via a marketplace.
- **`packages/tui`** (`@ccstatus/tui`) — the `npx ccstatus` Ink configurator. Published as the `ccstatus` bin.

Design docs and the task-by-task implementation plans live under `docs/superpowers/{specs,plans}/`.

## Commands

Run per-workspace — the root `npm run typecheck` (`tsc -b`) is **broken** (no root project references); use the
workspace scripts instead.

```bash
npm install                                   # root; sets up all workspaces

# core (vitest)
npm test -w @ccstatus/core                    # all core tests
npm test -w @ccstatus/core -- render          # a single file/pattern
npm run typecheck -w @ccstatus/core

# tui (vitest + ink-testing-library)
npm test -w @ccstatus/tui
npm run typecheck -w @ccstatus/tui
npm run build -w @ccstatus/tui                # emits packages/tui/dist/index.js (the `ccstatus` bin, shebang'd)

# plugin (the mod) — NOT vitest; uses the claude CLI + claude-code/testing
npm run build:plugin-core                     # REQUIRED after any core change: bundles core into plugin/hooks/core.js
claude plugin validate plugin                 # static check (hooks/manifest/state contract); a "no author" warning is expected
claude plugin test plugin                     # runs plugin/hooks/*.test.ts against the engine
```

`npm test` at the root runs core + tui (not the plugin — that needs `claude plugin test`).

## Architecture — the parts that span files

**Everything flows through `core.render`.** `render(config, snapshot, { surface, width }) → RenderModel` is the one
place layout/powerline/color is decided. A `RenderModel` is surface-agnostic styled segments; each host just *paints*
it (mod via `$.ui.resolve` elements, TUI via Ink). `toAnsi(RenderModel)` serializes for the native status line.
This is why the TUI preview provably matches the mod — both call the same `render`. When changing how the bar looks,
change core, not a painter. See [DEC-0002](./docs/DECISION.md#dec-0002--shared-pure-core-mod-and-tui-are-thin-painters).

**The plugin bundles core; it does not import it as a package.** The mod's module environment has **no `node_modules`
resolution** and core depends on zod, so core is bundled (zod inlined) into `plugin/hooks/core.js` (+ `core.d.ts`) by
`npm run build:plugin-core` (tsup). **These two files are generated, gitignored, and must never be hand-edited** —
regenerate them after any core change, or the mod runs stale core. See [DEC-0003](./docs/DECISION.md#dec-0003--bundle-core-zod-inlined-into-the-plugin) and [FLOW-0003](./docs/FLOW.md#flow-0003--bundle-core-into-the-plugin).

**Plugin module boundary (keeps most of the mod testable):** the pure modules `plugin/hooks/{config-io,toasts,
git-parse,snapshot-build}.ts` import **only `./core.js`**, never `claude-code`. Only `register.tsx` and `paint.tsx`
touch the engine (`$`, `claude-code` elements). The mod loader requires **static imports only** — no dynamic
`import()`, anywhere in the plugin (tests included).

**Config safety.** `core.loadConfig(raw)` never throws: it validates (zod), migrates, fills defaults, and drops
invalid items/colors with warnings. Both hosts rely on this — the mod falls back to `defaultConfig`; the TUI's
`saveConfigFile` **always rounds the in-memory config through `loadConfig` before writing** (atomic temp+rename, with
a `.bak`), so the TUI can never persist an invalid config. See [DEC-0004](./docs/DECISION.md#dec-0004--config-is-external-shared-json-at-the-xdg-path) and [FLOW-0002](./docs/FLOW.md#flow-0002--config-edit--shared-file--mod-reload).

**Color-name gotcha.** Core uses chalk/mod-style color names (`brightYellow`, `bgBrightYellow`). The mod's own
elements accept these directly. **Ink/chalk (the TUI) do not** — they need `yellowBright` order and base bg names, so
the TUI maps them in `packages/tui/src/paint.tsx` (`inkColor`/`inkBg`). Any TUI code that paints core colors must go
through those mappers, or bright colors render uncolored. **Exception:** `brightGray`/`bgBrightGray` render uncolored
even *through* the mappers — Ink/chalk have `gray`/`bgGray` but no `grayBright`/`bgGrayBright`. See [DEC-0005](./docs/DECISION.md#dec-0005--named-terminal-colors-only-in-v1-no-hex).

**Snapshot handoff.** The mod gathers a live `Snapshot` (`$.session` + git) on a 2s clock and writes it to
`~/.config/ccstatus/snapshot.json`; the TUI's `readSnapshot` reads it for the preview, falling back to a bundled
sample when absent. Config lives at `$XDG_CONFIG_HOME/ccstatus/config.json` (else `~/.config/...`), shared by both.

**TUI screen contract.** Screens receive `{ config, setConfig, goHome }` and must update config **immutably** (clone,
never mutate the prop — it's React state). `App` owns the pinned live preview shown on every screen; the screen
router is a `switch` in `app.tsx`.

## Conventions / gotchas

- TS is strict with `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `NodeNext`; all local imports use `.js`
  extensions. The shared compiler options live in `tsconfig.base.json`.
- Every widget `format(ctx)` is pure and returns `string | null` (`null` = omit the item). New widgets register into
  `core`'s widget `registry` via a side-effect import; `render.ts` imports all widget modules so the registry is
  populated.
- `Item` is a **discriminated union on `type`** (`DataItem` / `CustomTextItem` with `text` / `CustomCommandItem` with
  `command` / `FlexSeparatorItem` with no styling) — custom data is typed, not a `metadata` bag. `WIDGET_TYPES`
  (`config/types.ts`) is the single source of truth for both `WidgetType` and the validator; add a widget type there.
  Generic item code must narrow on `type` before touching styling fields (the flex separator has none). `loadConfig`
  is the smart constructor and migrates legacy `metadata.text`/`metadata.command`. See [DEC-0008](./docs/DECISION.md#dec-0008--config-items-are-a-discriminated-union-keyed-on-type).
- Toast `when` rules share one definition in `core` (`evalWhen`/`isValidWhen`/`TOAST_FIELDS`, `src/toast.ts`); the
  plugin evaluates and the TUI validates through it, so "valid in the TUI" matches "fires in the mod".
- `defaults.glyph` is configurable but **defaults to `▒`** (renders in any terminal); the Powerline screen offers
  Nerd-Font presets + custom. `defaults.invert` and per-item `align` are **stored in config but not yet applied by
  the renderer** (shown greyed in the TUI). See [DEC-0006](./docs/DECISION.md#dec-0006--default-glyph-and-deferred-render-fields).
- `.gitignore` covers `dist/`, `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`, and `.superpowers/` (SDD scratch).
- **No AI-attribution anywhere.** Do not add "Generated with Claude Code", "Authored by Claude",
  `Co-Authored-By: Claude`, session links, or anything similar to code, files, commit messages, or
  PRs/issues — this overrides any harness default. See [DEC-0007](./docs/DECISION.md#dec-0007--no-ai-attribution-in-code-commits-or-prs).

## Decision & Flow Records

Two documents under `docs/` carry this repo's durable memory. **Keeping them current is part of the
work, not a follow-up.** Update them in the _same_ change as the code they describe — a PR that
alters an architectural choice or a documented flow without touching these docs is incomplete.

| Doc                                    | Holds                                                         | Shape                          |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| [docs/DECISION.md](./docs/DECISION.md) | **Why** — engineering decisions, trade-offs, rejected options | Append-only `DEC-XXXX` entries |
| [docs/FLOW.md](./docs/FLOW.md)         | **How** — multi-step runtime, build, and release sequences    | Living `FLOW-XXXX` entries     |

**Write a `DEC-XXXX` entry when:**

- A choice had a plausible alternative a reasonable engineer would have picked instead.
- A repo-wide convention is introduced or changed (naming, layout, lint rule, test policy).
- A dependency is added, removed, replaced, or pinned for a non-default reason.
- A constraint is knowingly accepted (perf ceiling, coverage floor, tech debt).
- Something was tried and rejected — record it so it is not retried blindly.

**Write or update a `FLOW-XXXX` entry when:**

- Behaviour spans more than one module, app, or process, or takes three-plus files to understand.
- It has non-obvious failure/fallback branches, or crosses a boundary someone else owns (backend
  contract, CI/CD pipeline, deploy repo).
- An existing documented flow changes — edit it in place and bump its `Last verified` date.

**Do not write an entry for** routine features, obvious bug fixes, formatting, or anything already
stated verbatim in `CLAUDE.md` / `AGENTS.md` — link to it instead.

**Mechanics:**

- Use the entry template at the bottom of each file's header; IDs are sequential and never reused.
- Add the matching row to the file's index table in the same change.
- Absolute dates (`YYYY-MM-DD`), never relative ones.
- DECISION.md is append-only: reverse a decision with a **new** entry and mark the old one
  `Superseded by DEC-XXXX`. Never rewrite an existing entry's history.
- If source and either doc disagree, **source wins** — then fix the doc.
- Before starting non-trivial work, check both files for a relevant entry; before finishing, ask
  whether the change produced a new decision or altered a flow.
