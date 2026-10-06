# DECISION.md — Engineering Decision Log

> **What this is.** The durable record of _why_ this repo is the way it is. Every non-obvious
> engineering decision — architecture, tooling, dependencies, conventions, trade-offs consciously
> accepted — gets one entry here, in the format below.
>
> **What this is not.** A changelog, a task tracker, or a design spec. Runtime sequences live in
> [FLOW.md](./FLOW.md). Design specs and task-by-task plans live under
> [docs/superpowers/](./superpowers/); operative conventions live in [CLAUDE.md](../CLAUDE.md).
>
> **Why it exists.** So that neither a new engineer nor an AI agent has to re-derive a decision from
> the diff, and so a decision is re-opened deliberately rather than by accident.
>
> **Conflict rule:** if this document and the source disagree, the source wins — then update the
> affected entry (or supersede it) in the same PR.

---

## How to use this file

**Write an entry when any of these is true:**

- A choice has a plausible alternative that a reasonable engineer would have picked instead.
- A convention is being introduced or changed repo-wide (naming, layout, lint rule, test policy).
- A dependency is added, removed, replaced, or pinned for a non-default reason.
- A constraint is accepted knowingly (perf ceiling, coverage floor, browser support, tech debt).
- Something was tried and rejected — record the rejection so it is not retried blindly.

**Do not write an entry for:** routine feature work, bug fixes with an obvious fix, formatting, or
anything already captured verbatim in `CLAUDE.md` / `AGENTS.md` / other docs. Link instead.

**Rules of the log:**

1. Entries are **append-only**. Never rewrite history — to reverse a decision, add a new entry and
   mark the old one `Superseded by DEC-XXXX`.
2. IDs are sequential (`DEC-0001`, `DEC-0002`, …) and never reused.
3. Every entry gets a row in the index table below, in the same PR.
4. Dates are absolute (`YYYY-MM-DD`), never "last week".
5. Keep an entry short — context, decision, consequences. If it needs more than a screen, the detail
   belongs in a doc under `docs/` that the entry links to.
6. Cross-link freely: `DEC-0003`, `FLOW-0002`, other doc sections.

**Statuses:** `Accepted` · `Superseded by DEC-XXXX` · `Deprecated` · `Proposed` (only while a PR is
open — no entry stays `Proposed` on `main`).

---

## Index

| ID       | Date       | Title                                                                                | Status   | Scope          |
| -------- | ---------- | ------------------------------------------------------------------------------------ | -------- | -------------- |
| DEC-0001 | 2026-10-04 | Record decisions in DECISION.md and flows in FLOW.md                                 | Accepted | repo-wide      |
| DEC-0002 | 2026-10-04 | Shared pure core; mod and TUI are thin painters                                      | Accepted | repo-wide      |
| DEC-0003 | 2026-10-04 | Bundle core (zod inlined) into the plugin                                            | Accepted | plugin \| core |
| DEC-0004 | 2026-10-04 | Config is external shared JSON at the XDG path                                       | Accepted | repo-wide      |
| DEC-0005 | 2026-10-04 | Named terminal colors only in v1 (no hex)                                            | Accepted | repo-wide      |
| DEC-0006 | 2026-10-04 | Default glyph and deferred render fields                                             | Accepted | repo-wide      |
| DEC-0007 | 2026-10-04 | No AI-attribution in code, commits, or PRs                                           | Accepted | repo-wide      |
| DEC-0008 | 2026-10-04 | Config items are a discriminated union keyed on `type`                               | Accepted | core           |
| DEC-0009 | 2026-10-05 | Mod-side config writes are atomic via `$.process.run` + `mv`                         | Accepted | plugin         |
| DEC-0010 | 2026-10-05 | Distribution: unscoped `ccstatus` bin, private bundled core, committed plugin bundle | Accepted | repo-wide      |
| DEC-0011 | 2026-10-05 | TUI detects the mod and offers to install it on first run                            | Accepted | tui            |
| DEC-0012 | 2026-10-05 | Adopt an arant-design-inspired lint/format/quality toolchain                         | Accepted | repo-wide      |

---

## Entry template

Copy this block verbatim for a new entry.

```markdown
## DEC-XXXX — <Short imperative title>

- **Date:** YYYY-MM-DD
- **Status:** Accepted
- **Scope:** repo-wide | core | plugin | tui
- **Related:** DEC-XXXX, FLOW-XXXX, <doc/PR/work-item links>

### Context

What forced a choice. The problem, the constraints, what was true at the time.

### Decision

What we decided, stated in one or two sentences, in the active voice.

### Alternatives considered

- **<Option>** — why it was rejected.
- **<Option>** — why it was rejected.

### Consequences

- What this makes easy, and what it makes hard.
- What now has to be maintained, enforced, or watched.
- Any follow-up work this creates, and where it is tracked.
```

---

## DEC-0001 — Record decisions in DECISION.md and flows in FLOW.md

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** [FLOW.md](./FLOW.md), [CLAUDE.md](../CLAUDE.md)

### Context

Rationale lived only in commit messages, PR threads, and people's heads. `CLAUDE.md` says _what_ the
conventions are, not _why_. Decisions got re-litigated, and multi-step behaviour had to be re-traced
through source on every visit.

### Decision

Keep two ID-indexed docs under `docs/`, updated in the same PR as the change they describe.
DECISION.md is append-only (reverse a decision with a new entry); FLOW.md is edited in place with a
`Last verified` date.

### Alternatives considered

- **Put everything in `CLAUDE.md`** — it is an instruction file; accumulated history would drown the
  operative rules.
- **Use a wiki** — it drifts from the code, agents can't see it, and it isn't reviewed with the diff.
- **Rely on commit/PR messages alone** — no index, and they're invisible once the branch is gone.

### Consequences

- PRs that change architecture, conventions, dependencies, or a documented flow must carry a matching
  doc change to be complete.
- `CLAUDE.md` stays operative and points here for rationale.
- The two index tables must be kept in sync with their entries.

---

## DEC-0002 — Shared pure core; mod and TUI are thin painters

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0003, [FLOW-0001](./FLOW.md#flow-0001--mod-renders-the-above-prompt-band)

### Context

Both the mod and the standalone TUI must render the same configured bar, and the TUI must preview
_exactly_ what the mod draws. Two independent renderers would drift and double the widget/layout work.

### Decision

Keep all "how the bar looks" logic in a pure `@ccstatus/core`: `render(config, snapshot, opts)` returns
a surface-agnostic `RenderModel`, and each host only paints it — the mod via `$.ui.resolve` elements,
the TUI via Ink, the native status line via `toAnsi`.

### Alternatives considered

- **Mod-first, schema-only sharing** — the mod and TUI keep separate renderers sharing just the config
  schema; rejected because the preview drifts from the mod and every widget/layout change is done twice.
- **A scaffolder/generator** that emits a bespoke mod from config — rejected; config-time only, no live
  reconfiguration, and still needs a renderer.

### Consequences

- The TUI preview provably matches the mod (same `render`); new widgets/layout change exactly one place.
- Core must stay painter-agnostic (no `claude-code`/`ink` imports) and be bundled into the mod — see
  DEC-0003.

---

## DEC-0003 — Bundle core (zod inlined) into the plugin

> **Narrowed by [DEC-0010](#dec-0010--distribution-unscoped-ccstatus-bin-private-bundled-core-committed-plugin-bundle):** the generated bundle below is now **committed** (not gitignored) so git/marketplace installs can load the mod; it remains generated and CI-gated. The "gitignored artifact" wording in Decision is as-of 2026-10-04.

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** plugin | core
- **Related:** DEC-0002, DEC-0010, [FLOW-0003](./FLOW.md#flow-0003--bundle-core-into-the-plugin)

### Context

The mod's module environment has no `node_modules` resolution, and `@ccstatus/core` depends on zod.
Importing the package — or its relative `.ts` sources — does not resolve inside the mod sandbox.

### Decision

`tsup` bundles core with zod inlined into `plugin/hooks/core.js` (+ `core.d.ts`) via
`npm run build:plugin-core`; the mod imports `./core.js`. The bundle is a generated, gitignored
artifact, regenerated after any core change.

### Alternatives considered

- **Copy core `src/` into the plugin** — zod would still be unresolved, and `.js`→`.ts` import
  resolution is unreliable in the sandbox.
- **Publish core to npm and depend on it** — the sandbox can't resolve `node_modules` at all.

### Consequences

- One build step must stay in sync; `claude plugin test plugin` runs the bundle, so staleness surfaces
  there.
- Any new _runtime_ dependency added to core must be bundleable (pure JS) or it breaks the mod.
- Plugin "pure" modules import only `./core.js`; only `register.tsx`/`paint.tsx` import `claude-code`.

---

## DEC-0004 — Config is external shared JSON at the XDG path

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** [FLOW-0002](./FLOW.md#flow-0002--config-edit--shared-file--mod-reload)

### Context

The mod renders from, and the standalone TUI edits, the _same_ configuration. It must be shareable,
hand-editable, and richer than flat key/value options (per-widget colors, multiple lines, per-surface
layout).

### Decision

Store one JSON file at `$XDG_CONFIG_HOME/ccstatus/config.json` (else `~/.config/ccstatus/config.json`),
read by the mod via `$.fs` and written atomically by both writers (the TUI via node `fs`, the mod via
`$.process.run` + `mv`; see DEC-0009). The mod also writes `snapshot.json` beside it so the TUI can
preview with real numbers.

### Alternatives considered

- **Plugin `userConfig` / settings** — too flat for per-widget colors and multi-line layouts, and not
  editable by a standalone `npx` TUI.
- **Per-project config override** (`./.ccstatus.json`) — deferred to a later version (v1 is global only).

### Consequences

- Both sides share one path resolver; the mod hot-reloads on `mtime` change.
- All config must round-trip through `core.loadConfig` (which never throws); the TUI validates through it
  before its atomic save, so an invalid config is never written.

---

## DEC-0005 — Named terminal colors only in v1 (no hex)

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0002

### Context

ccstatusline's themes use hex colors, but the mod/terminal target is the 16-color named palette, and
core's color vocabulary is chalk/mod-style names (`red`, `brightYellow`, `bgBrightYellow`).

### Decision

v1 accepts only named terminal colors (validated by `isColor`). The 9 built-in themes are named-color
_approximations_ of ccstatusline's, and the TUI maps core's `brightX` names to Ink/chalk's `xBright`
order in `paint.tsx` (the mod's own elements accept core names directly).

### Alternatives considered

- **Support hex / truecolor now** — larger validation surface, a richer picker, and cross-surface
  fidelity work; deferred.
- **Pass core color names straight to Ink** — crashes or renders uncolored, because chalk's bright-color
  naming order differs; the `inkColor`/`inkBg` mappers are required.

### Consequences

- Simple validation and a named-color-list picker in the TUI.
- Built-in themes are not pixel-exact to ccstatusline; hex is a future extension.
- Any TUI code that paints core colors must go through the `paint.tsx` mappers.

---

## DEC-0006 — Default glyph and deferred render fields

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0002

### Context

ccstatusline's separator presets are Nerd-Font glyphs that require a patched terminal font. Inverted
separators and per-item alignment both need extra rendering machinery (an fg/bg swap; fixed-width
columns) beyond what v1 needs.

### Decision

`defaults.glyph` defaults to `▒` (renders in any terminal), with Nerd-Font presets + a custom entry
offered in the TUI's Powerline screen. `defaults.invert` and per-item `align` are stored in config (so
configs round-trip and the TUI can set them) but **not applied** by the v1 renderer; the TUI shows them
greyed / "not applied".

### Alternatives considered

- **Default to a Nerd-Font triangle** — shows tofu without a patched font; bad out-of-the-box UX.
- **Implement `invert` + column-width `align` now** — added scope/complexity for little v1 value;
  deferred.
- **Drop the fields entirely** — then configs wouldn't round-trip for a later version that adds them.

### Consequences

- Good out-of-the-box rendering; power users can switch to Nerd-Font separators.
- Two config fields are inert until a later version implements them (tracked here; revisit by
  superseding this entry).

---

## DEC-0007 — No AI-attribution in code, commits, or PRs

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0001

### Context

Default agent/harness tooling appends attribution to its output — `Co-Authored-By: Claude …`,
`🤖 Generated with Claude Code`, session links in commit trailers and PR descriptions, and similar
notes in code or files. The maintainer does not want this AI-attribution noise anywhere in the repo.

### Decision

Do not add "Generated by/with Claude Code", "Authored by Claude", `Co-Authored-By: Claude`, session
links, or any similar AI-attribution to code, comments, files, commit messages, or PR/issue text. This
rule **overrides** any default or harness instruction to add such lines. The existing history was
rewritten once to remove the trailers already present.

### Alternatives considered

- **Keep the trailers** — the maintainer rejects the noise in a repo meant to read as human-authored.
- **Strip from PRs but keep in commits** (or vice versa) — inconsistent; the rule applies everywhere.

### Consequences

- Commits and PRs carry only substantive messages; no attribution footer.
- Any agent working here must suppress its default attribution, regardless of harness defaults.
- Enacting this required a one-time history rewrite + force-push of `main` and `feat/ccstatus-core`,
  which changed every commit SHA.

---

## DEC-0008 — Config items are a discriminated union keyed on `type`

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** core
- **Related:** DEC-0004, [FLOW-0002](#flow-0002--config-edit--shared-file--mod-reload)

### Context

`Item` was a flat record (`{ id, type: WidgetType, fg?, bg?, … }`) with all per-widget data in an
untyped `metadata?: Record<string, unknown>` bag. That made illegal items representable — a
`custom-text` with no text, a `flex-separator` carrying colors — and the valid widget list was
duplicated as a hand-maintained `Set` in `validate.ts`, which could silently drift from `WidgetType`
and drop widgets.

### Decision

`Item` is a discriminated union on `type`: `DataItem` (styling only), `CustomTextItem` (`text: string`),
`CustomCommandItem` (`command: string`), and `FlexSeparatorItem` (no styling). `WIDGET_TYPES` (a `const`
array in `config/types.ts`) is the single source of truth — `WidgetType` is `typeof WIDGET_TYPES[number]`
and `validate.ts` builds its lookup set from the same array. The zod `itemSchema` stays intentionally
loose (`type: z.string()`, plus optional `text`/`command`/legacy `metadata`) so an unknown type is a
dropped item with a warning, not a hard parse failure; `loadConfig`/`cleanItem` is the smart constructor
that turns a parsed row into the union and migrates legacy `metadata.text`/`metadata.command` forward.

### Alternatives considered

- **Keep the flat `Item` + `metadata` bag** — rejected: illegal states stay representable and per-widget
  data is stringly-typed.
- **Typed `text?`/`command?` fields without a union** — lighter, but `custom-text` with no text and
  flex-with-colors would still type-check; the union makes them unrepresentable.
- **`z.discriminatedUnion` in the schema** — would hard-reject unknown/old types and lose the rest of
  the config; the soft schema + `cleanItem` boundary keeps the "never throw, degrade gracefully" contract.

### Consequences

- Per-widget invariants live in the type system; the `metadata` escape hatch is gone.
- The on-disk item shape changed (`metadata.text`/`metadata.command` → typed `text`/`command`); old
  configs are migrated at load, so they keep working.
- `flex-separator` has no styling fields, so generic item code narrows on `type` (helpers like
  `isStylable`, `rawOf`) before touching `fg`/`bg`/`merge`/`align`/`rawValue`.

---

## DEC-0009 — Mod-side config writes are atomic via `$.process.run` + `mv`

- **Date:** 2026-10-05
- **Status:** Accepted
- **Scope:** plugin
- **Related:** DEC-0004, [FLOW-0002](./FLOW.md#flow-0002--config-edit--shared-file--mod-reload)

### Context

The TUI's `saveConfigFile` writes `config.json` atomically (temp file + `rename`) so a reader — the
hot-reloading mod — never sees a half-written file. The mod has a second writer, `/ccstatus theme <name>`,
which originally did a plain `$.fs.write` over `config.json` (PR #1 review). The sandbox `$.fs` exposes
only `read`/`write`/`exists`/`stat` — no `rename` — so an interrupted or racing write there could truncate
the file, and on next read `parseConfig` would silently fall back to defaults, discarding the user's whole
config. A `.bak` copy made the loss recoverable but not preventable.

### Decision

Make the mod writer atomic the same way the git snapshot already shells out: write a `.tmp`, then
`$.process.run(['mv', '-f', tmp, path])`. `mv` within one directory is the `rename` syscall, which is
atomic, so no reader observes a partial file. The prior file is still copied to `config.json.bak` first.
A non-zero `mv` exit or any thrown error is caught and surfaced as "could not save the config file"; the
in-memory `config` atom is updated before the write, so the live bar reflects the new theme regardless.

### Alternatives considered

- **Keep the `.bak`-only plain write** — rejected: recoverable but still corruptible; contradicts the
  "atomic save" the project advertises.
- **Route all writes through the TUI (mod never writes config)** — rejected: the TUI isn't running during
  a mod session, so `/ccstatus theme` could not persist without launching `npx ccstatus`; worse UX.
- **Ask the engine for `$.fs.rename`** — out of our control and unbounded; `mv` via `$.process.run` is
  available today and reuses a dependency (`sh`/coreutils) the git snapshot path already assumes.

### Consequences

- Both config writers are now atomic with a `.bak`; `config.json` is never left truncated.
- The mod's config write depends on `mv` being on `PATH` (as the git snapshot depends on `git`/`sh`); a
  missing `mv` degrades to a caught "could not save" message, not a crash.
- One extra process spawn per theme save — negligible for a user-initiated command.

---

## DEC-0010 — Distribution: unscoped `ccstatus` bin, private bundled core, committed plugin bundle

- **Date:** 2026-10-05
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0003, DEC-0004, [FLOW-0004](./FLOW.md#flow-0004--release--distribution)

### Context

Phase 4 makes ccstatus publicly installable: `npx ccstatus` for the TUI and a
Claude Code marketplace entry for the mod. Three choices had real alternatives.

### Decision

1. **The TUI is published under the unscoped npm name `ccstatus`** (not
   `@ccstatus/tui`), so `npx ccstatus` runs it with no scope or global install.
   `@ccstatus/core` stays `private` and is **bundled** into the TUI's `dist`
   (tsup `noExternal`); it is listed in `devDependencies`, never `dependencies`,
   so `npm install ccstatus` never tries to fetch the private package.
2. **The mod is distributed via a repo-root `.claude-plugin/marketplace.json`**
   pointing at `./plugin` — `claude plugin marketplace add sushant-kum/ccstatus`.
3. **The generated plugin core bundle (`plugin/hooks/core.js` + `core.d.ts`) is
   committed** (un-ignored), because a git/marketplace install reads the repo
   as-is and the mod imports `./core.js` at load. CI rebuilds it and fails on any
   diff, so the committed bundle can never drift from `@ccstatus/core`. This
   narrows DEC-0003's "gitignored, never committed" stance for these two files
   only; they remain generated and must never be hand-edited.

### Alternatives considered

- **Keep `@ccstatus/tui` scoped** — rejected: `npx ccstatus` wouldn't work
  without a global install; worse first-run UX than the spec's `npx ccstatus`.
- **Publish `@ccstatus/core` to npm and depend on it** — rejected: core as a
  public package is an explicit non-goal (spec); bundling keeps one artifact.
- **Keep the plugin bundle gitignored and build it in a release step** —
  rejected for v1: marketplace installs read the source tree directly, so a
  build-on-release path needs a separate release branch/tag or attached
  artifacts; committing the bundle + a CI freshness gate is simpler and correct.

### Consequences

- One published npm artifact (`ccstatus`) with no private-package dependency.
- `plugin/hooks/core.js` / `core.d.ts` are tracked but generated — regenerate
  with `npm run build:plugin-core`; CI enforces freshness.
- Actual `npm publish` and marketplace release are a later, credentialed step
  (see FLOW-0004); this phase only prepares them.

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
ccstatus@ccstatus -y`. A present-but-`enabled:false` entry is reported as
`'disabled'` with a banner hinting `claude plugin enable` (the bar is otherwise
silently missing). Detection is read-only; install fires only from the explicit
keypress, guarded against re-entry. Any detection failure (no `claude` on
`PATH`, non-zero, non-JSON) degrades to `'unknown'` — a banner with manual
instructions and no keypress action — and never blocks or crashes the TUI.

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

## DEC-0012 — Adopt an arant-design-inspired lint/format/quality toolchain

- **Date:** 2026-10-05
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0003, DEC-0007, DEC-0010, [FLOW-0003](./FLOW.md#flow-0003--bundle-core-into-the-plugin), [FLOW-0006](./FLOW.md#flow-0006--lint-format--commit-quality-pipeline)

### Context

The repo shipped with no linter, formatter, or static-quality gates — style was
by-hand and inconsistent (no semicolons, variable line widths). We wanted the same
strict, opinionated toolchain the author runs on
[`sushant-kum/arant-design`](https://github.com/sushant-kum/arant-design), adapted to
this repo.

### Decision

Add a root-level toolchain covering all workspaces **and** the plugin (which is not an
npm workspace): **ESLint** (flat config — `@eslint/js` + `typescript-eslint`
recommended+stylistic, `import-x` ordering, `unused-imports`, `jsdoc`
`flat/recommended-typescript`, `no-secrets`, `react-hooks` scoped to the TUI, Prettier
integration, and a `warnToError` pass that escalates every preset `warn` to `error`),
**Prettier** (`singleQuote`, `printWidth 100`, `trailingComma es5`), **stylelint**,
**secretlint**, **cspell**, **knip**, **husky + lint-staged** pre-commit, and
**commitlint + commitizen** (Conventional Commits). Mirrors arant's configs, adapted
from pnpm `catalog:` to npm workspaces and with the Python/CSS-pipeline-only pieces
dropped. A one-time repo-wide reformat (added semicolons, reflowed to 100 cols) and the
accompanying strict-lint fixes (explicit return types, JSDoc on every function, no `any`,
no non-null `!`) were applied across the codebase.

### Alternatives considered

- **A lighter pragmatic rule subset** (mostly autofixable, low churn) — rejected: the
  goal was parity with arant's strict set.
- **Keep the existing no-semicolon / wide-line style** — rejected in favor of arant's
  Prettier profile.
- **Plain `jsdoc/flat/recommended`** — rejected: it demands redundant `{type}` tags on
  every `@param`/`@returns`; `flat/recommended-typescript` keeps the "document
  everything" requirement (descriptions + returns) while letting TypeScript carry the
  types.
- **ESLint 10** (the latest) — rejected: `eslint-import-resolver-typescript` pulls in
  `eslint-plugin-import`, whose peer range caps at ESLint 9, so the install fails to
  resolve. Pinned ESLint to `^9`.

### Consequences

- CI gains a `quality` job (`format:check`, `lint:error`, `stylelint:error`,
  `secretlint`, `cspell`, `knip`) — see [FLOW-0006](./FLOW.md#flow-0006--lint-format--commit-quality-pipeline).
- A `git commit` now runs lint-staged + knip (pre-commit) and commitlint (commit-msg):
  **commit messages must be Conventional Commits** going forward (existing history is
  not, and is not rewritten).
- Every function carries JSDoc and an explicit return type; `any` and non-null `!` are
  lint errors. New code must comply or it fails CI and the pre-commit hook.
- The generated plugin bundle `plugin/hooks/core.js` / `core.d.ts` is excluded from
  Prettier, ESLint, and cspell (it is tsup output); it stays guarded by the existing
  "Core bundle is fresh" drift check (DEC-0003, DEC-0010). The reformat of core source
  therefore requires regenerating and committing the bundle.
- `stylelint` is currently a configured no-op — the repo has no CSS/SCSS — but is ready
  if styling is ever added (runs with `--allow-empty-input`).
- Root TypeScript is pinned to the 5.x line (typescript-eslint 8 targets it; the
  workspaces were already on 5.5), even though 6.x exists.
- `cspell.json` carries a project dictionary that must grow with new domain terms, and
  `knip.json` must track entry points — both can fail CI if left stale.
