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

| ID       | Date       | Title                                                 | Status   | Scope          |
| -------- | ---------- | ----------------------------------------------------- | -------- | -------------- |
| DEC-0001 | 2026-10-04 | Record decisions in DECISION.md and flows in FLOW.md  | Accepted | repo-wide      |
| DEC-0002 | 2026-10-04 | Shared pure core; mod and TUI are thin painters       | Accepted | repo-wide      |
| DEC-0003 | 2026-10-04 | Bundle core (zod inlined) into the plugin             | Accepted | plugin \| core |
| DEC-0004 | 2026-10-04 | Config is external shared JSON at the XDG path        | Accepted | repo-wide      |
| DEC-0005 | 2026-10-04 | Named terminal colors only in v1 (no hex)             | Accepted | repo-wide      |
| DEC-0006 | 2026-10-04 | Default glyph and deferred render fields              | Accepted | repo-wide      |
| DEC-0007 | 2026-10-04 | No AI-attribution in code, commits, or PRs            | Accepted | repo-wide      |

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

- **Date:** 2026-10-04
- **Status:** Accepted
- **Scope:** plugin | core
- **Related:** DEC-0002, [FLOW-0003](./FLOW.md#flow-0003--bundle-core-into-the-plugin)

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
read by the mod via `$.fs` and written atomically by the TUI. The mod also writes `snapshot.json`
beside it so the TUI can preview with real numbers.

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
