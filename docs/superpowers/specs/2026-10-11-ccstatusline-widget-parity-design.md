# ccstatus — ccstatusline Widget Parity (Tier A + B) — Design Spec

**Date:** 2026-10-11
**Status:** Draft — pending review
**Author:** sushant@workfabric.com

## Purpose

Close the widget gap between ccstatus (21 widget types) and
[ccstatusline](https://github.com/sirmalloc/ccstatusline) (~94), to the extent the
mod's data model allows, and make the ccstatusline **importer** map every name
that has a ccstatus equivalent (it currently drops many, e.g. `session-usage`,
`weekly-usage`, `reset-timer`, `weekly-reset-timer`).

## Goals

- Add the widgets whose data ccstatus already has or can gather from `$.session`
  and the git probe (Tier A + feasible Tier B).
- Rewrite the importer so no mappable ccstatusline item is dropped, and the
  remaining drops carry a clear "unsupported (needs X)" reason.
- Keep the widget pattern unchanged: a widget is `register({ type, label, format })`
  in core; the TUI picker already lists `registry` automatically, so no TUI change
  is needed to expose new widgets.

## Non-goals (deferred — not feasible in the mod's data flow)

These need data sources the mod does not have; each would be its own subsystem,
and some cannot be gathered from the mod at all. They stay **dropped by the
importer with a reason**, not implemented:

- **Anthropic usage API** (OAuth fetch): `weekly-sonnet-usage`, `weekly-opus-usage`,
  `fable-weekly-usage`, all `extra-usage-*`.
- **Transcript JSONL parsing**: `*-speed`, `cache-hit-rate`/`cache-read`/`cache-write`,
  `compaction-counter`, `skills`, `session-name`, block-metrics fallback.
- **Extra CLIs**: all `jj-*`; deep git beyond the current probe
  (`git-staged`/`unstaged`/`untracked`/`ahead-behind`/`conflicts`/`origin-*`/
  `upstream-*`/`is-fork`/`review`/`ci-status`).
- **OS / network / config**: `free-memory`, `claude-status`, `claude-account-email`,
  `cache-timer`.
- **Engine state not exposed to `$.session`**: `vim-mode`, `voice-status`,
  `sandbox-status`, `remote-control-status`, and the Claude Code **`worktree-*`**
  object (the git worktree name is already covered by the existing `git-worktree`).
- Per-item `metadata.label` overrides and ccstatusline's per-widget display-mode
  cycling are **not** ported (ccstatus items have `rawValue` only).

## Background

The authoritative ccstatusline inventory lives in its
`src/utils/widget-manifest.ts` (92 data/presentational widgets + 2 layout). The
five usage/limit widgets the user hit all come from Claude Code's `rate_limits`
(`five_hour`/`seven_day` → `used_percentage` + `resets_at`), which ccstatus
**already captures** into `snapshot.{fivePct,fiveReset,weekPct,weekReset}` — it
merely _combines_ them into `rate-limit-5h`/`rate-limit-week`. So the finer-grained
split widgets need no new data.

## New widgets

Each is a core `register(...)` plus a `WIDGET_TYPES` entry. `labeled(raw,label,v)`
and the `fmtNum`/`fmtDur`/`pct`/`bar` helpers already exist in `core`. The `type`
ids match ccstatusline's names so the importer is 1:1.

### Tier A — existing snapshot data (no new fields)

| `type`               | Label        | Renders (data)                                                                                                  |
| -------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `session-usage`      | Session %    | `Session: NN%` from `fivePct`; `null`/`—` when unknown. (%-only; `rate-limit-5h` keeps the combined bar+reset.) |
| `weekly-usage`       | Weekly %     | `Weekly: NN%` from `weekPct`                                                                                    |
| `reset-timer`        | Reset        | `Reset: <dur>` from `until(fiveReset, now)`; `null` when none                                                   |
| `weekly-reset-timer` | Weekly Reset | `Weekly Reset: <dur>` from `until(weekReset, now)`                                                              |
| `thinking-effort`    | Effort       | `labeled(raw,'Effort', effort)` from `effort`; `null` when unknown                                              |
| `terminal-width`     | Width        | `labeled(raw,'Width', String(terminalWidth))`                                                                   |
| `git-insertions`     | Insertions   | `+${added}` when `repo`, else `null`                                                                            |
| `git-deletions`      | Deletions    | `-${deleted}` when `repo`, else `null`                                                                          |
| `context-bar`        | Ctx Bar      | `bar(ctxPct)` (the existing bar helper)                                                                         |
| `context-remaining`  | Ctx Left     | `labeled(raw,'Ctx Left', pct(100 - ctxPct))`                                                                    |

`until(iso, now)` already exists in `usage-widgets.ts` (currently module-private —
it will be exported or moved so the new timer widgets reuse it; do not duplicate).

### Tier B — new snapshot fields the mod gathers

| `type`              | Label      | Renders (data)                                                                                                   | New data source                                                        |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `session-id`        | Session ID | `sessionId` (raw) or first 8 chars; `null` when empty                                                            | `$.session.id()`                                                       |
| `context-window`    | Ctx Window | `labeled(raw,'Window', fmtNum(ctxWindow))` when `> 0`                                                            | `usage().context` window size (`maxTokens`)                            |
| `session-cost-rate` | Cost/hr    | `$X.XX/hr` = `cost / hours`, where `hours = (now-startedAt)/3.6e6`; `null` when `cost===null` or elapsed < 1 min | existing `cost` + `startedAt` (no new field)                           |
| `git-sha`           | SHA        | `gitSha` when `repo`, else `null`                                                                                | git probe `git rev-parse --short HEAD`                                 |
| `output-style`      | Style      | `labeled(raw,'Style', outputStyle)`; `null` when default/unknown                                                 | a `prompt.compose` hook capturing `outputStyle.name` into plugin state |

## New Snapshot fields

Added to `Snapshot` (`packages/core/src/snapshot.ts`) and mirrored in the plugin's
`CcstatusSnapshot` (`plugin/types/index.d.ts`):

- `sessionId: string`
- `ctxWindow: number`
- `gitSha: string`
- `outputStyle: string | null`

(`session-cost-rate`, `context-bar`, `context-remaining` reuse existing fields.)

## Data flow / plumbing (per new field)

1. **`snapshot-build.ts`** (`buildSnapshot`, pure): accept and set the new fields;
   `RawUsage` gains `ctxWindow` (from the usage context window size).
2. **`register.tsx`**:
   - `measure()`: add `$.session.id().catch(() => '')` → `sessionId`; have
     `extractContextUsage` read the window size (`context.maxTokens`, verified
     against the live `SessionUsage` type) → `ctxWindow`.
   - **git probe** (`GIT` shell string + `parseGit`): append a `git rev-parse
--short HEAD 2>/dev/null` field (one extra tab-delimited column) → `gitSha`
     (empty string when not a repo / detached).
   - **new hook** `on('prompt.compose', …)`: capture `outputStyle?.name` into an
     `outputStyle` atom (mirroring `captureEffort`), read in `measure()`. If the
     compose input does not expose `outputStyle` on this build, `output-style`
     degrades to `null` (and the widget renders nothing) — verified during
     implementation; drop the widget if genuinely unavailable.
3. **`snapshot-source.ts`** (`sanitize`): add `sessionId`/`gitSha` to
   `STRING_FIELDS`, `outputStyle` to `NULLABLE_STRING_FIELDS`, `ctxWindow` to
   `NUMBER_FIELDS`.
4. **`sample-snapshot.ts`**: add realistic values for the four new fields.
5. Regenerate the plugin bundle (`npm run build:plugin-core`) and commit it (core
   changed).

## Importer rewrite (`import-ccstatusline.ts`)

Replace the small `TYPE_MAP` with a complete mapping and custom-item handling:

- **Data-widget mappings** (ccstatusline → ccstatus), 1:1 where names match, plus:
  `current-working-dir` → `cwd`, `session-cost` → `cost`, `context-percentage`
  (remaining variant stays `context-percentage`; the dedicated `context-remaining`
  only when ccstatusline marks remaining — otherwise `context-percentage`), and all
  the new widgets above.
- **Custom items** (new handling — these are not `DataItem`s):
  `custom-text` → `{ type:'custom-text', text: raw.customText ?? '' }`;
  `custom-command` → `{ type:'custom-command', command: raw.commandPath ?? '' }`;
  `custom-symbol` → `custom-text` with the glyph as `text`.
- **Layout:** `flex-separator` → `flex-separator`; `separator` is a ccstatus global
  default (`defaults.separator`), not an item → dropped with a note ("ccstatus uses
  a global separator; set it on the Powerline screen").
- **Unsupported:** every deferred type (Non-goals) is dropped with a specific
  warning naming why (e.g. `dropped "weekly-opus-usage" — needs the Anthropic usage
API, not available to the mod`). A shared `UNSUPPORTED: Record<string, string>`
  (type → reason) drives these messages so they are precise, not generic.
- Preserve existing behaviour: `backgroundColor`→`bg`, `rawValue`, `merge`.

## Testing

- **core**: a unit test per new widget (enabled → expected string from a seeded
  snapshot; `null`/`—` on the empty/absent case); `context-remaining` = `100-ctxPct`;
  `session-cost-rate` math incl. the <1-min guard; `until`-based timers.
- **importer** (`import-ccstatusline.test.ts`): each new mapping produces the right
  item (incl. `custom-text`/`custom-command` carrying text/command); an unsupported
  type is dropped with its specific reason; `separator` dropped with its note; a
  realistic multi-widget ccstatusline config round-trips.
- **snapshot-source**: the four new fields survive `sanitize` and a wrong-typed
  field is dropped.
- **plugin pure**: `snapshot-build` sets the new fields; `git-parse` parses the new
  SHA column (and the no-repo case). Engine-integration tests (register/band) still
  run only under the preview build.
- Full gate green (lint, format, cspell — add `jujutsu`/`jj` etc. terms if any new
  prose needs them, knip, typechecks, bundle-drift).

## Documentation impact (same change)

- **`DEC-0015`** — "ccstatusline widget parity: which widgets are ported vs
  deferred, and why" (records the Tier A/B set, the deferred list with their data
  reasons, and that `worktree-*` is dropped). Index row added.
- Update the **`WIDGET_TYPES`** note and the widget list references in CLAUDE.md if
  needed; the importer behaviour is covered by the existing FLOW-0002 (config edit)
  — add a line only if the flow changes materially (it does not).
- The new `prompt.compose` hook and the extra git-probe column: note in
  FLOW-0001 (band render)/the snapshot handoff only if they change the flow's shape
  (a one-line mention of the new fields).

## Risks & mitigations

- **`output-style` capture** may not be exposed on this engine build → the widget
  degrades to `null` and is dropped from the importer map with a reason; verified in
  implementation before shipping the widget.
- **`usage().context` window-size field name** must be confirmed against the live
  `SessionUsage` type (`maxTokens` vs another key) — a one-line check before wiring
  `ctxWindow`.
- **git probe change** adds a column to the tab-delimited `GIT` output; `parseGit`
  must stay backward tolerant (missing column → empty SHA) so a stale snapshot
  doesn't break rendering.
- Scope: this is widgets + snapshot fields + importer, not a new data subsystem —
  the deferred list is explicitly out.

## Rollout

Single feature branch → PR, executed subagent-driven (one task per widget cluster +
the plumbing + the importer + docs), bundle regenerated and committed, full gate
green. Visual/engine verification is the author's manual check (preview build).
