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

| ID       | Date       | Title                                                                                    | Status                 | Scope          |
| -------- | ---------- | ---------------------------------------------------------------------------------------- | ---------------------- | -------------- |
| DEC-0001 | 2026-10-04 | Record decisions in DECISION.md and flows in FLOW.md                                     | Accepted               | repo-wide      |
| DEC-0002 | 2026-10-04 | Shared pure core; mod and TUI are thin painters                                          | Accepted               | repo-wide      |
| DEC-0003 | 2026-10-04 | Bundle core (zod inlined) into the plugin                                                | Accepted               | plugin \| core |
| DEC-0004 | 2026-10-04 | Config is external shared JSON at the XDG path                                           | Accepted               | repo-wide      |
| DEC-0005 | 2026-10-04 | Named terminal colors only in v1 (no hex)                                                | Superseded by DEC-0023 | repo-wide      |
| DEC-0006 | 2026-10-04 | Default glyph and deferred render fields                                                 | Accepted               | repo-wide      |
| DEC-0007 | 2026-10-04 | No AI-attribution in code, commits, or PRs                                               | Accepted               | repo-wide      |
| DEC-0008 | 2026-10-04 | Config items are a discriminated union keyed on `type`                                   | Accepted               | core           |
| DEC-0009 | 2026-10-05 | Mod-side config writes are atomic via `$.process.run` + `mv`                             | Accepted               | plugin         |
| DEC-0010 | 2026-10-05 | Distribution: unscoped `ccstatus` bin, private bundled core, committed plugin bundle     | Accepted               | repo-wide      |
| DEC-0011 | 2026-10-05 | TUI detects the mod and offers to install it on first run                                | Accepted               | tui            |
| DEC-0012 | 2026-10-05 | Adopt an arant-design-inspired lint/format/quality toolchain                             | Accepted               | repo-wide      |
| DEC-0013 | 2026-10-07 | Status line is rendered by a native settings.json command, not the mod                   | Accepted               | repo-wide      |
| DEC-0014 | 2026-10-09 | Publish the TUI under the scoped name `@sushant-kum/ccstatus`                            | Accepted               | repo-wide      |
| DEC-0015 | 2026-10-11 | ccstatusline widget parity: ported set and deferred set                                  | Accepted               | core \| plugin |
| DEC-0016 | 2026-10-12 | Release versioning via commit-and-tag-version, one lockstep version across all manifests | Accepted               | repo-wide      |
| DEC-0017 | 2026-10-12 | Publish on tag via GitHub Actions; npm auth by OIDC Trusted Publishing                   | Accepted               | repo-wide      |
| DEC-0018 | 2026-10-12 | Linked surface layouts: a `SurfaceLayout.linked` flag mirrored on write + on load        | Accepted               | core \| tui    |
| DEC-0019 | 2026-10-12 | Centralize linked-surface line mirroring in a core helper (`writeLinkedLines`)           | Accepted               | core \| tui    |
| DEC-0020 | 2026-10-12 | Theme colors are a positional palette, not per widget type                               | Accepted               | core \| tui    |
| DEC-0021 | 2026-10-12 | Breaking config migration to positional palettes                                         | Accepted               | core           |
| DEC-0022 | 2026-10-13 | Light palette text is `brightWhite` (SGR 97), not `white` (SGR 37)                       | Superseded by DEC-0023 | core           |
| DEC-0023 | 2026-10-13 | Colors are an xterm-256 palette (indices 16-255), not named terminal colors              | Accepted               | core \| tui    |
| DEC-0024 | 2026-10-13 | Breaking migration to 256-color indices                                                  | Accepted               | core           |
| DEC-0025 | 2026-10-13 | Branded `ColorIndex` type minted only by `isColorIndex` / `asIndex`                      | Accepted               | core \| tui    |
| DEC-0026 | 2026-10-14 | Conditional widgets stay visible with a placeholder (ccstatusline parity)                | Accepted               | core           |
| DEC-0027 | 2026-10-15 | Capture reasoning effort from the streaming `turn.step` hook                             | Accepted               | plugin         |
| DEC-0028 | 2026-10-15 | Built-in themes mirror ccstatusline's palettes and are always folded into the config     | Accepted               | core           |
| DEC-0029 | 2026-10-15 | Column alignment (`defaults.alignColumns`) pads cells into shared columns                | Accepted               | core \| tui    |
| DEC-0030 | 2026-10-15 | Configurator shows a half-block brand logo and the injected version                      | Accepted               | tui            |
| DEC-0031 | 2026-10-15 | Column alignment compensates the separator a merged cell drops                           | Superseded by DEC-0032 | core           |
| DEC-0032 | 2026-10-15 | Column alignment aligns by visual (post-merge) column                                    | Accepted               | core           |
| DEC-0033 | 2026-10-16 | Rate-limit percentage widgets show 0% when the percentage is unavailable                 | Accepted               | core           |

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
- **Note:** Superseded in part by [DEC-0013](#dec-0013--status-line-is-rendered-by-a-native-settingsjson-command-not-the-mod) (the native status line is no longer piped through the mod).
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
- **Status:** Superseded by DEC-0023
- **Note:** Superseded in part by [DEC-0013](#dec-0013--status-line-is-rendered-by-a-native-settingsjson-command-not-the-mod) (mod elements are Ink's and need the core color mapping).
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
- **Note:** The unscoped `ccstatus` name is unavailable on npm (rejected as too similar to `cc-status`); superseded in part by [DEC-0014](#dec-0014--publish-the-tui-under-the-scoped-name-sushant-kumccstatus) — the TUI publishes as the scoped `@sushant-kum/ccstatus`.
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

## DEC-0013 — Status line is rendered by a native settings.json command, not the mod

- **Date:** 2026-10-07
- **Status:** Accepted
- **Note:** The status-line command string is now `npx @sushant-kum/ccstatus statusline` (the TUI publishes scoped — see [DEC-0014](#dec-0014--publish-the-tui-under-the-scoped-name-sushant-kumccstatus)).
- **Scope:** repo-wide
- **Related:** DEC-0002, DEC-0005, DEC-0011, [FLOW-0007](./FLOW.md#flow-0007--native-status-line-render-path), [spec](./superpowers/specs/2026-10-07-ccstatus-statusline-command-design.md)

### Context

The mod drove the native status line through `$.ui.status`. That API takes plain text and
refuses control characters, so the ANSI from `toAnsi` could never colour it — the status
line was monochrome. Separately, the band/pane colour bug had the same root: the engine's
`Text` is Ink's, so core's chalk-style names (`brightYellow`) rendered uncoloured there too.

### Decision

Render the native status line with a Claude Code `settings.json` `statusLine` **command**,
as [ccstatusline](https://github.com/sirmalloc/ccstatusline) does. A new
`ccstatus statusline` subcommand reads the shared `config.json` + `snapshot.json` and prints
`toAnsi(render(..., { surface: 'statusline' }))`; Claude Code renders that ANSI in colour.
The TUI writes (and removes) the `statusLine` block — opt-in, scope-prompted (User vs
Project), merging into existing settings, and backing up + confirming before replacing a
different `statusLine`. The mod stops calling `$.ui.status` (it still paints band/pane/toasts
and writes `snapshot.json`). The Ink colour mapping moves into core as
`rendererColor`/`rendererBg` and is used by **both** the TUI and the mod paint modules.

### Alternatives considered

- **Keep `$.ui.status` with plain text** — rejected: loses all colour, the main point of the bar.
- **Overlay live cost/context from the status-line stdin JSON** — deferred: the snapshot
  is already fed by the mod on a 2s clock; revisit if staleness matters.

### Consequences

- The status line needs the mod running (for `snapshot.json`); with no live snapshot the
  command prints nothing rather than sample data.
- Enabling the status line is an explicit TUI action that edits the user's `settings.json`.
- Supersedes in part DEC-0002 (the status-line pipe is no longer via the mod) and DEC-0005
  (mod elements are Ink and need the colour mapping; `brightGray` still renders uncoloured).
- Core colour changes now affect the mod paint, TUI paint and CLI together; regenerate the
  plugin bundle after changing them.

## DEC-0014 — Publish the TUI under the scoped name `@sushant-kum/ccstatus`

- **Date:** 2026-10-09
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** [DEC-0010](#dec-0010--distribution-unscoped-ccstatus-bin-private-bundled-core-committed-plugin-bundle), [DEC-0013](#dec-0013--status-line-is-rendered-by-a-native-settingsjson-command-not-the-mod), [FLOW-0004](./FLOW.md#flow-0004--release--distribution)

### Context

DEC-0010 chose the **unscoped** name `ccstatus` so `npx ccstatus` would work with
no scope. npm rejects that name — it is "too similar to" the existing package
`cc-status` (npm collapses hyphens when comparing), so the unscoped name is
permanently unavailable.

### Decision

Publish the TUI as the **scoped** package `@sushant-kum/ccstatus` (the scope is the
author's npm account, always available). The CLI is `npx @sushant-kum/ccstatus`
(and `npx @sushant-kum/ccstatus statusline` for the native status line); the bin
name stays `ccstatus`. This supersedes DEC-0010's unscoped-name choice and updates
DEC-0013's status-line command string.

### Alternatives considered

- **A different unscoped name** (`ccstatus-bar`, `ccbar`, …) — keeps `npx <name>`
  scope-free, but risks another npm similarity rejection and a less recognizable
  name; rejected in favour of a guaranteed-available scope.
- **Contest npm's block** for bare `ccstatus` — slow, not guaranteed; rejected.
- **An org scope like `@ccstatus`** — not owned by the author; the personal scope
  `@sushant-kum` is guaranteed.

### Consequences

- The npm workspace is now `@sushant-kum/ccstatus`, so workspace commands are
  `npm <script> -w @sushant-kum/ccstatus` (CI, `index.test.ts`'s build step, and
  the docs updated accordingly).
- `STATUSLINE_COMMAND` is `npx @sushant-kum/ccstatus statusline`; the TUI writes
  that into `settings.json`, and `isOurs` recognizes the exact command plus a
  path-form `ccstatus statusline`.
- The product identity is unchanged: `@ccstatus/core`, the `ccstatus`
  mod/marketplace id, the `/ccstatus` command, and the `~/.config/ccstatus/` paths
  all keep the `ccstatus` name.
- Publishing a scoped public package needs `--access public` (already in the TUI's
  `publishConfig`).

## DEC-0015 — ccstatusline widget parity: ported set and deferred set

- **Date:** 2026-10-11
- **Status:** Accepted
- **Scope:** core | plugin
- **Related:** [DEC-0002](#dec-0002--shared-pure-core-mod-and-tui-are-thin-painters), [DEC-0008](#dec-0008--config-items-are-a-discriminated-union-keyed-on-type), [spec](./superpowers/specs/2026-10-11-ccstatusline-widget-parity-design.md)

### Context

ccstatusline ships far more widgets than ccstatus. The importer used to drop
unsupported types with one blanket reason, and the mod cannot source every
datum those widgets need (it has `$.session` and git, nothing else).

### Decision

Port every ccstatusline widget whose data the mod can already source; defer the rest.

- **Added (15):** usage/limit splits (`session-usage`, `weekly-usage`,
  `reset-timer`, `weekly-reset-timer`); context (`context-bar`,
  `context-remaining`, `context-window`); `thinking-effort`; git
  (`git-insertions`, `git-deletions`, `git-sha`); `session-id`;
  `session-cost-rate`; `output-style`; `terminal-width`.
- **Line counts:** `git-insertions`/`git-deletions` report true line counts
  (`insertions`/`deletions` snapshot fields from `git diff --numstat`, staged +
  unstaged), distinct from the file counts (`added`/`modified`/`deleted`) shown by `git-changes`.
- **Snapshot:** six new fields (`sessionId`, `ctxWindow`, `gitSha`,
  `outputStyle`, `insertions`, `deletions`). The previously dormant `cost` and `terminalWidth` fields are now
  wired through `buildSnapshot` and `register.tsx`.
- **Deferred (not implemented; the mod cannot source the data):**
  - `worktree-*` — no `$.session` worktree object (`git-worktree` already covers git).
  - Anthropic usage API: `weekly-sonnet-usage`, `weekly-opus-usage`,
    `fable-weekly-usage`, `extra-usage-*`.
  - Transcript parsing: `*-speed`, `cache-hit-rate`/`cache-read`/`cache-write`,
    `compaction-counter`, `skills`, `session-name`.
  - Deeper git probe: staged/unstaged/untracked, ahead-behind, conflicts, `origin-*`,
    `upstream-*`, `is-fork`.
  - Needs the `gh`/`glab` CLI specifically (not the git probe): `git-review`, `git-ci-status`.
  - Cache-TTL tracking: `cache-timer`.
  - OS/network/config: `free-memory`, `claude-status`, `claude-account-email`.
  - Engine state: `vim-mode`, `voice-status`, `sandbox-status`, `remote-control-status`.
- **Importer:** `import-ccstatusline.ts` maps every supported type, drops
  known-unsupported types with a specific reason, and falls back to a generic
  `dropped unmapped ccstatusline item "..."` message for anything unrecognized
  (e.g. `jj-*`/Jujutsu, which is not enumerated). Custom items with an empty payload
  are dropped with a warning rather than silently omitted at render.

### Alternatives considered

- **Port everything with stubs that render nothing** — misleading in the TUI
  picker; rejected in favour of explicit, reasoned drops.
- **Add transcript/API readers to the mod now** — new I/O surface, auth and
  failure modes; deferred until there is demand.

### Consequences

- New widgets are a `register(...)` in core and appear in the TUI picker automatically.
- Core changed, so the plugin bundle must be regenerated (`npm run build:plugin-core`).
- Un-deferring a group means sourcing its data in the mod first, then
  registering the widget and updating the importer's reason table.

## DEC-0016 — Release versioning via commit-and-tag-version, one lockstep version across all manifests

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** [FLOW-0004](./FLOW.md#flow-0004--release--distribution), [DEC-0010](#dec-0010--distribution-unscoped-ccstatus-bin-private-bundled-core-committed-plugin-bundle), [DEC-0014](#dec-0014--publish-the-tui-under-the-scoped-name-sushant-kumccstatus)

### Context

Releases were fully manual (FLOW-0004): bump the version by hand in several files, write no
changelog, tag by hand. The version lives in four places that must agree — root `package.json`
(added as the source of truth), the published TUI `packages/tui/package.json`, the mod
`plugin/.claude-plugin/plugin.json`, and the marketplace manifest `.claude-plugin/marketplace.json`
(which carries it **twice**: `metadata.version` and `plugins[].version`). Commits already follow
Conventional Commits (commitlint), so a changelog and the next version are derivable.

### Decision

Adopt `commit-and-tag-version` (the maintained fork of the deprecated `standard-version`) as a root
devDependency, driven by `.versionrc.json`, invoked with `npm run release` (`release:dry` for a
preview). One **lockstep** version is shared by every manifest — there is no independent
per-package versioning. Root `package.json` is the single source of truth (`packageFiles`); its
`version` plus the TUI package and the plugin manifest are bumped by the built-in JSON updater
(`bumpFiles`). Tags have **no prefix** (`0.1.0`, not `v0.1.0`; `tagPrefix: ""`).

Two concerns are handled by lifecycle hooks:

- **`postbump`** regenerates the committed core bundle (`npm run build:plugin-core`, per DEC-0003)
  and runs `scripts/sync-marketplace-version.mjs`, which syncs the marketplace manifest's two nested
  version fields — the built-in updater only bumps a top-level `version`, which that file lacks. The
  sync is a textual replace so the hand-written formatting is preserved.
- **`postchangelog`** runs `npm run format:fix` then `git add -A`. The JSON updater rewrites bumped
  files with `JSON.stringify(…, 2)`, which expands short inline arrays (e.g. `keywords`) to
  multiline and would fail Prettier's `format:check` on the release commit; `format:fix` normalises
  them. `commitAll: true` plus the `git add -A` fold the regenerated bundle and the marketplace
  manifest (neither a `bumpFile`) into the single release commit.

Publishing to npm, pushing, and the marketplace step stay **manual** (FLOW-0004) — this decision
automates versioning, changelog, and tagging only.

### Alternatives considered

- **Independent per-package versions (separate tags/runs per artifact)** — the TUI and the mod ship
  as one product on one cadence; two version lines and two release runs add ceremony with no benefit.
- **A custom commit-and-tag-version updater for the marketplace manifest** — the updater API couples
  to the tool and still reflows the file; a tiny textual `postbump` sync is simpler and formatting-safe.
- **`standard-version`** — deprecated and unmaintained; `commit-and-tag-version` is its drop-in fork.
- **Keep releases fully manual** — error-prone across four version sites and yields no changelog.

### Consequences

- Cutting a version is `npm run release` (see FLOW-0004); the four manifests and the two marketplace
  fields can no longer drift.
- `npm run release` **must** run from a clean working tree — `commitAll`/`git add -A` fold all tracked
  changes into the release commit.
- The release commit runs the husky pre-commit hook (lint-staged **and knip**). New release helpers
  must stay lint/knip-clean; `scripts/sync-marketplace-version.mjs` is registered as a knip `entry`.
- `.versionrc.json` scripts are opaque to knip, so a helper referenced only there would be reported
  unused unless added to `entry`.

## DEC-0017 — Publish on tag via GitHub Actions; npm auth by OIDC Trusted Publishing

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** [DEC-0016](#dec-0016--release-versioning-via-commit-and-tag-version-one-lockstep-version-across-all-manifests), [FLOW-0004](./FLOW.md#flow-0004--release--distribution), [DEC-0014](#dec-0014--publish-the-tui-under-the-scoped-name-sushant-kumccstatus)

### Context

DEC-0016 automated versioning/changelog/tagging, but publishing stayed manual: `npm publish` by
hand and no visible release. Two artifacts ship — the TUI to npm and the mod to the "marketplace."
The marketplace is **this repo**: users run `claude plugin marketplace add sushant-kum/ccstatus`,
which reads `.claude-plugin/marketplace.json` from the default branch, so there is no external
marketplace registry to push to — once the tagged commit is on `main`, the mod is released. The only
genuinely outward action is the npm publish; a GitHub Release is the visible artifact for the mod side.

### Decision

Add `.github/workflows/release.yml`, triggered on pushing a version tag (`[0-9]*.[0-9]*.[0-9]*` —
the no-prefix tags from `npm run release`; the glob's `*` also matches a `-prerelease` suffix). A
single `release` job: verifies the tag equals every manifest version; re-runs typecheck/tests/TUI
build and the bundle-freshness check at the tag; `npm publish -w @sushant-kum/ccstatus --access
public --tag <channel>`; then creates a GitHub Release whose notes are this version's `CHANGELOG.md`
section. A **prerelease** tag (`X.Y.Z-<label>.<n>`, created by `npm run release -- --prerelease
<label>`) is detected from the `-` and routed to a dist-tag derived from the label (`-rc.1` → `rc`,
`-pre-id.4` → `pre-id`; empty/numeric → `next`) with the GitHub Release marked `--prerelease`; a
stable tag publishes to `latest`. This keeps a prerelease from ever becoming `latest` on npm or the
"Latest" release on GitHub.

npm auth is **OIDC Trusted Publishing** — no long-lived token or secret. npm (≥ 11.5.1, which the job
pins defensively) running on GitHub Actions exchanges the `id-token: write`
OIDC token with the registry automatically, and emits **provenance** for the public package (no
`--provenance` flag needed; `repository.url` must match the repo). `gh release create` uses the
built-in `GITHUB_TOKEN` (`contents: write`). A one-time, out-of-band setup configures the trusted
publisher on npmjs.com (owner `sushant-kum`, repo `ccstatus`, workflow `release.yml`, case-sensitive).

### Alternatives considered

- **Token-based publish (`NPM_TOKEN` secret + `--provenance`)** — simpler first-time setup and no
  npmjs-side config, but keeps a long-lived credential in repo secrets. Rejected in favour of no
  stored secret.
- **Trigger on GitHub Release published** — would require creating the release first (by hand or a
  second workflow); tag-push matches the existing `git push --follow-tags` flow with one trigger.
- **Publish the mod to an external registry** — none exists; the marketplace is this repo.
- **Trust main CI and skip re-verification before publish** — a tag can point anywhere; re-verifying
  at the tagged commit is cheap insurance against shipping a red build.

### Consequences

- No npm secret lives in the repo; a leaked Actions log cannot leak a publish credential.
- **One-time setup is required before trusted publishing works:** configure the trusted publisher on
  npmjs.com (package Settings → Trusted Publisher). `@sushant-kum/ccstatus@0.1.0` was already
  published by hand, so the package exists and no bootstrap publish is needed; the first automated
  release (`0.1.1`) flows straight through the workflow with provenance. See [FLOW-0004](./FLOW.md#flow-0004--release--distribution).
- The workflow pins no npm version; it installs `npm@latest` each run (Trusted Publishing needs
  ≥ 11.5.1). A future npm major could change behaviour — watch the publish step.
- Provenance + OIDC only work from this repo's Actions on a public package; publishing from a fork or
  locally produces no attestation (and locally, no OIDC — it falls back to whatever auth is present).
- The tag==version guard means a hand-made or mismatched tag fails fast instead of publishing.

## DEC-0018 — Linked surface layouts: a `SurfaceLayout.linked` flag mirrored on write and on load

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** [DEC-0002](#dec-0002--shared-pure-core-mod-and-tui-are-thin-painters), [DEC-0008](#dec-0008--config-items-are-a-discriminated-union-keyed-on-type), [FLOW-0002](./FLOW.md#flow-0002--config-edit--shared-file--mod-reload), docs/superpowers/specs/2026-10-12-surface-link-design.md

### Context

Users wanted band/statusline/pane to show the same item layout without configuring
each surface separately, kept in sync live. `theme` and `defaults` are already
global; only `SurfaceLayout.lines` differs per surface.

### Decision

Add an optional `linked` flag to `SurfaceLayout`. Surfaces flagged `linked` form one
group (with three linkable surfaces, a single group is fully general). The group is
held byte-identical by two mechanisms: the TUI propagates every edit to all linked
members, and `loadConfig` normalizes linked surfaces on load (drops a lone flag;
syncs divergent lines to the first linked surface in band→statusline→pane order,
with a warning). `core.render` and both painters are unchanged — each surface still
renders its own, now-identical, `lines`. The TUI gains `l` (link: pick one or all,
confirm before replacing a non-empty target) and `u` (unlink: regenerate the
detached surface's item ids, dissolve a sub-2 group). Linking mirrors `lines` only,
not `enabled`.

### Alternatives considered

- **Shared layout by reference** (store `lines` once, surfaces point at it) — forces
  `render`, `toAnsi`, both painters, and migration to resolve references; large blast
  radius for no user-visible gain. Rejected.
- **One-time copy (no live link)** — simpler, but the user chose live mirroring.

### Consequences

- The config gains a backward-compatible optional field; old configs load unlinked.
- Linked members keep identical item ids (so a shared `custom-command` keyed by id
  would be computed once, were the mod populating command outputs); **unlink
  regenerates ids** so detached surfaces no longer share a cache key.
- `saveConfigFile` already rounds through `loadConfig`, so the persisted file always
  satisfies the linked-identical invariant, and the mod self-heals hand-edited drift.

## DEC-0019 — Centralize linked-surface line mirroring in a core helper (`writeLinkedLines`)

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** [DEC-0018](#dec-0018--linked-surface-layouts-a-surfacelayoutlinked-flag-mirrored-on-write-and-on-load), [DEC-0002](#dec-0002--shared-pure-core-mod-and-tui-are-thin-painters)

### Context

DEC-0018 keeps linked surfaces identical by two mechanisms: `loadConfig` normalization on
read, and the TUI mirroring every edit to linked members on write. The write-side mirror was
implemented inline at each edit site in `screens/items.tsx` (`commit`, `applyLink`). A PR review
(PR #5) flagged that this scatters the invariant across call sites — a future TUI edit path that
forgets to mirror would leave the linked group divergent in memory until the next `loadConfig`
silently resolved it against the user's intent.

### Decision

Move the linked-surface logic into one core module, `packages/core/src/config/links.ts`, exporting
`LINKABLE`, the `LinkableSurface` type, `linkedSurfaces(surfaces)`, `writeLinkedLines(surfaces,
surface, lines)`, and `normalizeLinks` (relocated from `validate.ts`). **Every layout write routes
through `writeLinkedLines`**, the single chokepoint that writes a surface's `lines` and mirrors them
(deep-cloned) to its linked members. The TUI's `commit`/`applyLink` call it instead of hand-rolling
the propagation loop, and the TUI reuses core's `LINKABLE`/`LinkableSurface` rather than redefining
them (one source of truth). Behavior is unchanged — this is a refactor with new unit tests for the
helpers.

### Alternatives considered

- **Leave the mirror inline in the TUI (status quo)** — works, but the in-memory invariant depends
  on every current and future edit site remembering to propagate; rejected for fragility.
- **Encode the group as a richer type so illegal states are unrepresentable** — a type-design review
  judged this not worth the churn given only three surfaces and `loadConfig` as the smart
  constructor; the chokepoint helper captures most of the benefit at far lower cost.

### Consequences

- New linked-lines write paths MUST go through `writeLinkedLines`; the in-memory invariant now has
  one enforcement point (plus `loadConfig` at the config boundary).
- `LINKABLE`/`LinkableSurface` are the single source of truth for which surfaces are linkable; the
  "single group is fully general" reasoning still holds only while `LINKABLE.length === 3`.
- Core changed, so the plugin bundle is regenerated (`npm run build:plugin-core`).

---

## DEC-0020 — Theme colors are a positional palette, not per widget type

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** DEC-0005, DEC-0002, DEC-0008, [spec](./superpowers/specs/2026-10-12-positional-palette-theming-design.md)

### Context

Themes were keyed by widget type and covered only 5-8 of the ~36 types, so every uncovered widget
rendered in the terminal-default grey. Color also followed widget identity rather than position,
unlike ccstatusline's powerline themes, where colors cycle across the visible segments.

### Decision

A theme is `PaletteSlot[]` (`{ fg?, bg? }`), cycled across the visible items of each line by
position. Merged cells share the preceding slot, flex separators are skipped (left uncolored), and
the counter resets per line. A bg-only slot gets an auto-contrast fg from `contrastFg` (named colors
only, black/white lookup, per DEC-0005). Assignment is a separate pure pass,
`packages/core/src/layout/palette.ts` (`assignPaletteColors`), wired into `render` between
`lineToCells` and `composeLine`.

### Alternatives considered

- **Extend the per-widget map to every widget type** — still ties color to identity, needs ~36
  entries per theme, and gives no powerline-style cycling.

### Consequences

- Per-item `fg`/`bg` are removed from `ItemStyle`; the item editor is palette-only.
- Every surface is colored by position through the one `render` path (DEC-0002).
- New widgets need no theme entries.
- Core changed, so the plugin bundle is regenerated (`npm run build:plugin-core`).

---

## DEC-0021 — Breaking config migration to positional palettes

- **Date:** 2026-10-12
- **Status:** Accepted
- **Scope:** core
- **Related:** DEC-0004, DEC-0020

### Context

Existing configs carry per-item `fg`/`bg` and per-widget (object-shaped) themes, neither of which
exists in the positional model.

### Decision

`loadConfig` drops per-item colors with a warning, drops legacy object-shaped themes with a warning
and falls back to the builtin palettes, guarantees a `default` palette, and reassigns an unknown
active theme to `default`.

### Alternatives considered

- **Translate old per-widget themes into palettes** — there is no faithful mapping from identity-keyed
  colors to positions; rejected as guesswork.

### Consequences

- A one-time visible restyle of existing configs, accepted while pre-1.0.
- `loadConfig` stays non-throwing (DEC-0004); the user sees the drops as warnings.

---

## DEC-0022 — Light palette text is `brightWhite` (SGR 97), not `white` (SGR 37)

- **Date:** 2026-10-13
- **Status:** Superseded by DEC-0023
- **Scope:** core
- **Related:** DEC-0005, DEC-0020

### Context

Reported as "statusline text looks greyish." Investigation proved the mod (Ink) and native status
line (`toAnsi`) emit byte-identical SGR for a given palette — so the surfaces are not colored
differently. The real cause is the color itself: the named color `white` serializes to SGR **37**,
which most terminals render as a dim light-grey, not a crisp white. On a dark or grey background
(e.g. a `bgBrightBlack` slot) that is low-contrast and reads as "greyish." `brightWhite` is SGR
**97**, the crisp white, and both render paths map it identically (`toAnsi` 97; Ink/chalk
`whiteBright` 97).

### Decision

For readable light-on-dark text, use `brightWhite`, not `white`:

- `contrastFg` returns `brightWhite` (was `white`) for any background not in `LIGHT_BG`.
- Every builtin theme's light-text slot uses `brightWhite`; `black` stays for light backgrounds.

`white` remains a valid, selectable color (DEC-0005) — a user may still choose it explicitly; it is
simply not the auto-contrast or builtin default.

### Alternatives considered

- **Keep `white` and treat it as a host/terminal problem** — rejected: the dim-white is a real,
  controllable contrast weakness in our defaults, independent of the painter.
- **Luminance/auto-brighten in the renderer** — rejected; DEC-0005 keeps color a fixed named lookup.

### Consequences

- Builtin palettes and auto-contrast gain crisp light text; no API or schema change.
- Existing saved configs that baked in literal `white` are unchanged (their choice is preserved);
  re-activating or re-picking a builtin refreshes them.
- Core changed, so the plugin bundle is regenerated (`npm run build:plugin-core`).

---

## DEC-0023 — Colors are an xterm-256 palette (indices 16–255), not named terminal colors

- **Date:** 2026-10-13
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** DEC-0005 (superseded), DEC-0013, DEC-0020, DEC-0022 (absorbed), DEC-0024, [spec](./superpowers/specs/2026-10-13-256-color-palette-design.md)

### Context

Claude Code's native status line dims the 16 basic colors. It dims both the basic SGR form
(`30–47` / `90–107`) and the indexed form `38;5;0–15`, so named colors can never render crisp there.
The 256-color cube (indices 16–255) renders crisp. Truecolor (`38;2;r;g;b`) is not supported in the
status line, which is why the fix is 256 colors and not hex.

### Decision

- Colors are xterm-256 indices **16–255**; 0–15 are rejected.
- `PaletteSlot` is `{ fg?: number; bg?: number }`.
- One `indexToRgb` function/mapping (`theme/xterm256.ts`) feeds both painters: `toAnsi` emits
  `ESC[38;5;Nm` / `ESC[48;5;Nm`, and Ink receives `#rrggbb`.
- `contrastFg` is luminance-based and returns 16 (black) or 231 (white).

This supersedes DEC-0005 (named colors only) and absorbs DEC-0022 (`brightWhite` auto-contrast text),
which no longer applies.

### Alternatives considered

- **Keep named colors and only serialize them as 256-color** — rejected: it adds no new color choice,
  and the dim 0–15 range stays reachable.
- **Truecolor / hex** — rejected: unsupported in the status line.

### Consequences

- Crisp colors on every surface, and a much larger palette for the TUI picker.
- Core changed, so the plugin bundle is regenerated (`npm run build:plugin-core`).

---

## DEC-0024 — Breaking migration to 256-color indices

- **Date:** 2026-10-13
- **Status:** Accepted
- **Scope:** core
- **Related:** DEC-0004, DEC-0021, DEC-0023

### Context

Saved configs hold legacy string color names and 0–15 indices, which DEC-0023 no longer allows.

### Decision

`cleanThemes` maps legacy string names and 0–15 indices to fixed 256-color equivalents (cube or grayscale), with a warning
for each, and drops out-of-range values. `loadConfig` stays non-throwing. This mirrors DEC-0021.

### Alternatives considered

- **Reject legacy configs** — rejected: it would discard user themes; a lossy mapping with warnings is kinder.

### Consequences

- A one-time, slight visible restyle of existing configs, accepted while pre-1.0.
- The user sees every mapping and drop as a warning (DEC-0004).

## DEC-0025 — Branded `ColorIndex` type minted only by `isColorIndex` / `asIndex`

- **Date:** 2026-10-13
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** DEC-0023, DEC-0024

The "integer 16–255" invariant of DEC-0023 was only a runtime check on a plain `number`, so any code path could hand
`indexToRgb`, `contrastFg`, or `toAnsi` an arbitrary number.

### Decision

`ColorIndex = number & { readonly __colorIndex: unique symbol }` (`colors.ts`) is threaded through `PaletteSlot`,
`Cell`, `Segment`, `indexToRgb`/`indexToHex`, `contrastFg`, and the renderer-color helpers. The only mints are
`isColorIndex` (runtime-validated) and `asIndex` (authored constants; guarded by tests over every table). The legacy-name
table `NAMED_INDEX` is a `ReadonlyMap` (prototype-safe `get`). `indexToRgb` and the ANSI serializer additionally clamp to
16–255 so even a bad cast cannot emit a malformed or dimming code.

### Alternatives considered

- **Plain `number` plus runtime checks only** — rejected: nothing stops an unvalidated number reaching the painters.

### Consequences

Tests that build colors from literals must use `asIndex(...)`.

---

## DEC-0026 — Conditional widgets stay visible with a placeholder (ccstatusline parity)

- **Date:** 2026-10-14
- **Status:** Accepted
- **Scope:** core
- **Related:** DEC-0015, PR #12

### Context

Most data widgets return `null` from `format(ctx)` to omit themselves when their snapshot field is empty (the
documented "`null` = omit" contract). For `thinking-effort` and `git-worktree` this made them invisible in the common
case: the mod only captures a reasoning effort from an `effort.active` engine event (none until the user sets one, and
`$.session` exposes no getter to derive one), and `gitWorktree` is only set inside a linked `git worktree` checkout —
so on a normal clone with no explicit effort, both widgets rendered nothing even when added to the bar, which reads as
"broken".

### Decision

Make these two widgets stay visible with a meaningful placeholder instead of omitting:
`thinking-effort` shows the captured level or `default` when none is set (matching ccstatusline, which labels the unset
case `default` rather than inventing a level); `git-worktree` shows the worktree name or `⎇ —` on the main working
tree, while still returning `null` outside a repo (consistent with every other git widget). This mirrors the existing
in-repo placeholder pattern already used by `git-branch` and `git-root-dir` (`|| '?'`).

### Alternatives considered

- **Keep omitting when empty** — rejected: the item disappears despite being configured, which looks broken.
- **Derive/guess a concrete effort (e.g. map "default" → "high")** — rejected: the engine withholds a concrete level at
  default and there is no honest source to derive one; a guessed level would be wrong.
- **A per-item "hide when empty" toggle** — rejected as over-engineering for two widgets; revisit if more widgets need it.

### Consequences

- `thinking-effort` and `git-worktree` deliberately deviate from the "`null` = omit" convention (DEC-0008 note /
  CLAUDE.md); the deviation is documented inline on each `format`.
- The ccstatusline-parity label `default` is now part of the ported-widget behavior tracked by DEC-0015.

---

## DEC-0027 — Capture reasoning effort from the streaming `turn.step` hook

- **Date:** 2026-10-15
- **Status:** Accepted
- **Scope:** plugin
- **Related:** DEC-0026, FLOW-0001, PR #14 (supersedes the `classic.Stop` capture from PR #13)

### Context

The `thinking-effort` widget needs the session's active reasoning effort, but the mod never captured
it: it read `e.effort?.active` on the `turn.complete` and `tool.call` function-hook events, neither of
which carries `effort`. PR #13 moved the capture to a `classic.Stop` hook (the classic Stop input does
carry `effort.active`), which passed the engine test — but the test only _manufactures_ that event. A
live hot-reload probe showed `classic.Stop` is **never dispatched to the mod at runtime**, so
`snapshot.effort` stayed `null` even with `CLAUDE_EFFORT=xhigh`.

### Decision

Capture the effort on the streaming **`turn.step`** event — the one function-hook event the engine
puts the active effort on (`TurnStepInput.effort`, a bare `low|medium|high|xhigh|max` value). It is an
async-generator hook: read the effort, then forward the stream unchanged with `yield* next(e)`. A pure
`effortFromEvent` helper handles both the bare value and the classic `{ active }` shape and is
unit-tested; the streaming wiring is guarded by `claude plugin validate` (the harness cannot drive a
streaming hook) and was confirmed by the live probe.

### Alternatives considered

- **`classic.Stop` hook (PR #13)** — rejected: not dispatched to the mod live; the engine test gave a
  false positive because it raises the event directly.
- **Read `CLAUDE_EFFORT` from the environment** — rejected: the var is injected only into spawned tool
  shells; it is absent from the engine process env (so `$.env.get` can't see it) and from
  `$.process.run` children (the probe showed `<unset>`).

### Consequences

- Effort now populates once a model turn runs (turn.step fires mid-turn); it is not available from
  slash-commands alone.
- The `{ active }` branch of `effortFromEvent` is now defensive only — no live mod path produces it —
  but is kept and tested as a documented fallback.
- The streaming `yield* next(e)` forwarding cannot be exercised by `claude plugin test`; that is an
  accepted, named coverage gap (see FLOW-0001).

---

## DEC-0028 — Built-in themes mirror ccstatusline's palettes and are always folded into the config

- **Date:** 2026-10-15
- **Status:** Accepted
- **Scope:** core
- **Related:** DEC-0020 (positional palettes), DEC-0023 (xterm-256), DEC-0015 (ccstatusline parity)

### Context

The built-in themes carried ccstatusline's names but only approximate colours (translated from the
old basic-hue palettes), and `one-dark`/`tokyo-night`/`classic` diverged from ccstatusline's keys.
Separately, `loadConfig` folded the built-ins in only when a config defined _no_ themes, so once a
config persisted its themes (which every TUI save does), later built-in palette updates never reached
it — a user was stuck with whatever colours shipped when their config was first written.

### Decision

Replace the built-in set with ccstatusline's `POWERLINE_THEMES`, using its **ansi256 (Level-2) tier**
verbatim as the positional palette (the status line has no truecolor — DEC-0023 — so the hex tier is
unusable). The set is `default` (ccstatus's own, unchanged) plus ccstatusline's ten: `nord`,
`nord-aurora`, `monokai`, `solarized`, `minimal`, `dracula`, `catppuccin`, `gruvbox`, `onedark`,
`tokyonight`. `classic` is dropped; `one-dark`/`tokyo-night` are renamed to ccstatusline's spelling.

`loadConfig` now **always** folds the current built-ins into the themes map (`withBuiltinThemes`): a
saved theme whose name and palette match an unmodified legacy built-in is refreshed to the current
one (or dropped if removed/renamed), a theme the user edited or authored is kept, and any missing
built-in is added. A saved active-theme name that was renamed resolves via a small alias map
(`one-dark→onedark`, `tokyo-night→tokyonight`, `classic→default`) instead of silently falling back.

### Alternatives considered

- **Keep the old "don't fold built-ins when custom themes exist" behavior** — rejected: it strands
  existing configs on stale palettes, so the ccstatusline update would never reach current users.
- **Overwrite every built-in-named theme on load** — rejected: the TUI lets users edit palettes, so
  this would clobber their customizations; the unmodified-fingerprint check preserves edits.
- **Use ccstatusline's hex (Level-3) tier** — rejected: the status line is xterm-256 only (DEC-0023).

### Consequences

- Built-in themes are always present and track the canonical palettes; a user can no longer trim the
  built-in set (deleting one re-appears on load), but may still add and edit their own themes.
- Every saved config now carries all 11 built-ins. Existing configs upgrade on next load; a config
  that had hand-edited a built-in keeps its edit under that name.

---

## DEC-0029 — Column alignment (`defaults.alignColumns`) pads cells into shared columns

- **Date:** 2026-10-15
- **Status:** Accepted
- **Scope:** core | tui
- **Related:** DEC-0006 (deferred `align`/`invert`), DEC-0002 (shared core)

### Context

Each line of a surface was laid out independently, so a multi-line band/pane never lined its cells up
into columns — cell 2 of row 1 rarely started at the same x as cell 2 of row 2. The `defaults.align`
field existed but had no effect (the TUI showed it as "stored, not yet applied"), so there was no way
to justify content either.

### Decision

Add a boolean `defaults.alignColumns` (default `false`). When on, `render` runs a new
`alignColumns(lines, align)` pass over all of a surface's cell rows before coloring/composing: for
each positional cell index it finds the widest cell across every line and pads the rest to that width,
justifying content with `defaults.align` (`left`→pad right, `right`→pad left, `center`→split). This
also finally gives `defaults.align` an effect (within aligned columns); it stays inert otherwise.
The TUI Defaults screen gains an `align columns` toggle and makes `align` editable, noting it only
applies while alignment is on. Because both painters go through core's `render` (DEC-0002), the band,
pane, native status line, and TUI preview all align identically.

### Alternatives considered

- **Per-item `align` justification** — deferred: v1 uses the single `defaults.align`; per-item
  alignment remains unimplemented (still per DEC-0006).
- **A per-surface flag** — rejected for v1: a global default is simpler and matches the other
  `defaults` fields; revisit if surfaces need to differ.

### Consequences

- Flex separators are excluded from column widths and never padded (they still absorb slack in
  `composeLine`); a row mixing flex with column alignment may not form a perfect grid.
- Columns are positional by cell index; merged cells fold after padding. Single-line surfaces are
  unaffected. Padding widens content, so narrow terminals truncate as before.
- `defaults.align` is now partially active (column justification only); DEC-0006's "not yet applied"
  note holds for every other use (per-item align, `invert`).

---

## DEC-0030 — Configurator shows a half-block brand logo and the injected version

- **Date:** 2026-10-15
- **Status:** Accepted
- **Scope:** tui
- **Related:** DEC-0010 (committed generated artifacts), DEC-0012 (toolchain)

### Context

The `npx @sushant-kum/ccstatus` configurator menu showed a plain `ccstatus · configurator`
header — no brand mark and no version, so users couldn't tell which release they were editing with.
A terminal (Ink renders text/ANSI) can't display the SVG/PNG brand assets, and inline-image
protocols (iTerm2, Kitty, sixel) are non-portable and clash with Ink's cell model.

### Decision

Render the brand mark as **truecolor half-blocks** (`▀`, foreground = top pixel, background = bottom
pixel) sampled from the real `brand/ccstatus-app-icon-512.png`, at 16 columns × 8 rows. The grid is
**generated and committed** as `packages/tui/src/logo-art.ts` by `scripts/gen-logo-art.mjs`
(`npm run gen:logo-art`), which decodes the PNG with built-in `zlib` and downsamples — no image
dependency, no Chrome. The menu shows it beside `ccstatus v<VERSION>`, falling back to a `◀◀` glyph
when `COLORTERM` is not truecolor. The version is injected at build time via a `define`
(`CCSTATUS_VERSION`) in both `tsup.config.ts` and `vitest.config.ts`, read from the package version
and exposed as `VERSION` from `src/version.ts` — no runtime file read.

### Alternatives considered

- **Inline terminal image** (iTerm2/Kitty/sixel) — rejected: non-portable and fights Ink's renderer.
- **Hand-drawn `◀◀` glyph** — rejected as the primary: it approximates rather than using the asset;
  kept only as the non-truecolor fallback.
- **Runtime `require('../package.json')` for the version** — rejected: brittle across the bundled bin
  vs. source/test layouts; a build-time define is deterministic.

### Consequences

- `logo-art.ts` is a generated artifact: excluded from Prettier/ESLint/cspell (like the plugin
  bundle) but kept in `tsc`, and regenerated with `npm run gen:logo-art` when the brand icon changes.
- The logo looks best on truecolor terminals; 256/16-colour terminals get chalk-degraded colours or
  the `◀◀` fallback. It adds 8 rows of height to the menu header.

---

## DEC-0031 — Column alignment compensates the separator a merged cell drops

- **Date:** 2026-10-15
- **Status:** Superseded by [DEC-0032](#dec-0032--column-alignment-aligns-by-visual-post-merge-column)
- **Scope:** core
- **Related:** DEC-0029 (column alignment), DEC-0020 (merged cells share the preceding palette slot), DEC-0008 (item `merge` flag)

### Context

With `defaults.alignColumns` on (DEC-0029), a row containing a merged cell misaligned every column
from the merge onward. `alignColumns` pads each positional cell to its column width, but
`composeLine`'s `mergeCells` then concatenates a `merge: true` cell's text into its predecessor with
**no separator** between them, while non-merged rows keep a separator at that boundary. The merged
cell and everything after it therefore sat one separator-width to the left of the matching columns in
other rows — e.g. a merged `Reset`+`Weekly` pair left `Weekly` and the cell after it out of line.

### Decision

`alignColumns` now takes the separator width (`render` passes 0 for `separator: 'none'`, else 1). A
cell that will actually merge — `merge: true`, not the first cell, and with a non-flex predecessor —
prepends that many spaces to its padded text, filling the gap the dropped separator would have
occupied. Columns then line up across rows whether or not a given row merges at that position. The
merge test is a single shared `willMerge` predicate called by both `mergeCells` (to concatenate) and
`alignColumns` (to compensate), so the two cannot drift out of agreement.

### Alternatives considered

- **Align after merging, over merged runs** — rejected: merge patterns differ per line, so merged-cell
  indices no longer correspond across rows and positional alignment breaks differently.
- **Leave it (document as a limitation)** — rejected: users reasonably expect merged cells to align;
  it read as a bug.

### Consequences

- The compensating spaces render in the predecessor's colour (merged cells already share the preceding
  palette slot — DEC-0020), so in `powerline` mode the filled gap is a flat block rather than a chevron;
  widths align, the inner chevron is intentionally absent. Consecutive merges each compensate their own
  dropped separator.

---

## DEC-0032 — Column alignment aligns by visual (post-merge) column

- **Date:** 2026-10-15
- **Status:** Accepted
- **Scope:** core
- **Supersedes:** [DEC-0031](#dec-0031--column-alignment-compensates-the-separator-a-merged-cell-drops)
- **Related:** DEC-0029 (column alignment), DEC-0020 (merged cells share the preceding palette slot)

### Context

DEC-0031 aligned by **raw item index** and tried to patch merges by re-adding the separator width a
merged cell drops. That only holds when every row merges at the same index. A merged widget pair is two
items that render as one cell, so a row with a merge has one fewer _visual_ cell than raw items: its
later items shift left by one index relative to rows of singles. Raw-index alignment then lines up cells
from different visual columns (e.g. a row's third widget against another row's fourth), and a column
whose widest entry is a merged pair is sized from only the pair's first widget — sibling cells below it
span the first widget, not the full merged cell. A real multi-line bar (model+effort merged on one row,
weekly+reset merged on another, singles elsewhere) came out ragged.

### Decision

`alignColumns` aligns by **visual column**: it groups each line into runs (a lead cell plus the cells
that `willMerge` into it — the same rendered cells `composeLine` produces), measures each run's combined
width, and pads every run to the widest run at its visual-column index across all lines. A merged pair
therefore sets its column's width and sibling cells span the full width; items after a merge line up
because columns are counted after merging, not before. Padding lands on a run's edge members so a merged
run stays contiguous and reads as one block. `render` no longer computes or passes a separator width.

This adopts the **principle** DEC-0031 rejected — treating merged runs, not raw items, as the alignment
unit — while applying it _before_ `composeLine` merges rather than after (aligning on the merged segment
list is listed as its own rejected alternative below). DEC-0031 rejected that principle on the grounds
that differing merge patterns make columns non-correspondent; that reasoning was wrong, because merged
pairs keep the visual-column _count_ equal across rows even as raw indices diverge, which is exactly when
raw-index alignment fails.

### Alternatives considered

- **Keep raw-index alignment + separator compensation (DEC-0031)** — rejected: cannot size a column from
  a merged pair's full width, and misaligns every item after a merge when merge positions differ per row.
- **Align after `composeLine` merges, on the segment list** — rejected: padding would have to be split
  back across the original cells for per-cell palette colouring, which `composeLine` has already folded;
  grouping runs up front keeps colouring and width logic in one pass before compose.

### Consequences

- Column width is driven by rendered (merged) cells, matching what the eye groups. The flat-block note
  from DEC-0031 still holds: pad added to a merged run's trailing member takes the shared slot colour, so
  in `powerline` mode a widened merged column fills as one block.
- Lines with unequal visual-column counts (a merge on one row with no matching column on another) still
  align best-effort per visual index, as before — a strict grid needs matching visual-column counts.

---

## DEC-0033 — Rate-limit percentage widgets show 0% when the percentage is unavailable

- **Date:** 2026-10-16
- **Status:** Accepted
- **Scope:** core
- **Related:** [DEC-0002](#dec-0002--shared-pure-core-mod-and-tui-are-thin-painters) (shared pure core — these widgets render identically across all surfaces)

### Context

The session (`rate-limit-5h`, `session-usage`) and weekly (`rate-limit-week`, `weekly-usage`) widgets
read `snapshot.fivePct`/`weekPct`, which are `number | null` — null while the engine has no rate-limit
reading yet (`rateLimits` is empty "before the first reading"). The widgets rendered that null state as
a `—` placeholder (the "limit" variants) or by omitting themselves entirely (the "%" variants). The
`Ctx Used` widget, by contrast, reads the non-null `ctxPct` (default 0) and always shows `0%`. The
inconsistency read as a bug: a 0 or not-yet-known percentage showed nothing instead of `0%`.

A genuine numeric 0 already rendered `0%` — `pct(0)` is `"0%"` and the widgets guarded on `=== null`,
not on a falsy check — so only the unavailable (null) case was affected.

### Decision

The four rate-limit percentage widgets coerce an unavailable percentage to 0 for display
(`snapshot.fivePct ?? 0`), so they always show `0%` like `Ctx Used`, never `—` or nothing. This matches
the existing house rule that a zero value renders (e.g. `session-cost-rate` shows `$0.00/hr`, not null).
The reset-time suffix is unaffected — it still appears only when its timestamp is known, since a missing
reset time cannot be shown as 0.

The snapshot type stays `number | null`: the null (unknown) state is preserved in the data model so
toast rules (`TOAST_FIELDS.fivePct`/`weekPct`) can still distinguish "no reading" from a real 0. The
coercion lives only in the display widgets.

### Alternatives considered

- **Default `fivePct`/`weekPct` to 0 in the snapshot** — rejected: would erase the unknown state for
  toast evaluation, which legitimately needs to tell "no reading" from an actual 0%.
- **Keep the `—` placeholder** — rejected: the reporter wants parity with `Ctx Used`. The engine's
  `rateLimits` is empty both "before the first reading" (transient — filled within one ~2s measure cycle)
  and "off a subscription" (permanent — such users never receive rate-limit data). `0%` is an acceptable
  interim in the first case and a steady, truthful "nothing measured" in the second (see Consequences);
  neither warrants a distinct placeholder.

### Consequences

- The `—` "no data yet" indicator is gone for these widgets; an unavailable percentage reads `0%`. In
  the rare case rate-limit data is never provided, these widgets show a steady `0%`.
