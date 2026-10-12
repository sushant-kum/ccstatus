# ccstatus — Linked Surface Layouts (band / statusline / pane) — Design Spec

**Date:** 2026-10-12
**Status:** Approved for planning
**Author:** sushant@workfabric.com

## Purpose

Let a user keep two or three of the display surfaces — **band**, **statusline**,
**pane** — showing the **same item layout** (which items, their order, their
line/position, and each item's own `fg`/`bg`/`align`/`merge`), kept in sync
**live**: editing the layout on any linked surface updates the others, and the
link persists across sessions. This turns "configure the bar three times" into
"configure once, mirror to the rest."

`theme` and `defaults` (separator, padding, align, glyph, invert) are already
**global** in the config, so all surfaces already share them — this feature adds
nothing there. Only the per-surface item layout (`SurfaceLayout.lines`) differs
today, and that is what linking mirrors.

## Goals

- A surface can be **linked** to one or both of the other two; linked surfaces
  always render the same `lines`.
- Editing a linked surface in the TUI **propagates** to every linked member.
- The link is stored in the shared config and survives reload, so the **mod and
  the TUI agree** (both round through `loadConfig`).
- Linking is reversible (**unlink**), and link/unlink have clear TUI affordances
  with a destructive-replace confirmation.

## Non-goals

- **Toasts** are not linkable (the `toasts` surface has no `lines`).
- **`enabled` is not synced** — a surface can share the layout yet stay hidden.
  Linking mirrors layout only, not visibility.
- **No per-surface theming / divergent defaults** — theme and defaults are global
  (unchanged); this is out of scope, not a regression.
- **No "shared layout by reference"** data model (see Rejected alternative).
- **No change to `core.render` or either painter** — rendering is untouched.

## Approach — "mirror on write", render untouched

Keep each surface's own `lines`. Add an optional `linked` flag per surface. The
set of surfaces with `linked: true` forms **one link group** (with only three
linkable surfaces, a single group is fully general — two disjoint pairs are
impossible). Linked surfaces are held **byte-identical** by two mechanisms:

1. **TUI propagation on write** — editing any linked surface writes the new
   `lines` to every linked member.
2. **`loadConfig` normalization** — on load, linked surfaces are forced identical
   (self-heals any hand-edited drift).

Because the surfaces still each carry their own (identical) `lines`, `core.render`
and both painters are unchanged — they paint each surface's own lines, which
happen to match.

### Rejected alternative — "shared layout by reference"

Store the shared `lines` once and have linked surfaces reference it. Conceptually
tidier, but it forces `render`, `toAnsi`, both painters, migration, and the TUI to
resolve references — a large blast radius for no user-visible difference from the
mirror approach. Rejected.

## Config schema (core)

`packages/core/src/config/types.ts` — add one optional field:

```ts
export interface SurfaceLayout {
  enabled: boolean;
  lines: Item[][];
  linked?: boolean; // part of the single band/statusline/pane link group
}
```

- **Link group** = `{ s ∈ {band, statusline, pane} : config.surfaces[s].linked }`.
- Absent/`false` ⇒ not linked. Backward compatible: existing configs load as
  "no links".
- `schema.ts` (zod) gains `linked: z.boolean().optional()` on the surface-layout
  shape. `toasts` is unaffected (different shape; not linkable).

## Invariant and `loadConfig` normalization

**Invariant:** after `loadConfig`, every linked surface has identical `lines`.

`packages/core/src/config/validate.ts`, after the per-surface layouts are built:

1. Collect the linked members in fixed order `[band, statusline, pane]`.
2. If **fewer than 2** members are linked, the group is meaningless → clear the
   stray `linked` flag and warn (`"dropped lone surface link on <surface>"`).
3. Otherwise choose the **canonical** surface = the first linked member in that
   fixed order. If any other member's `lines` differ from canonical, overwrite
   them with a **deep clone** of canonical's `lines` and warn
   (`"linked surfaces diverged; synced <members> to <canonical>"`). At rest the
   members are already identical (the TUI keeps them so), so this only fires on
   manual JSON edits.

This runs inside the existing non-throwing `loadConfig` path, so both hosts get a
consistent, already-mirrored config. `saveConfigFile` already rounds through
`loadConfig` before writing, so the persisted file always satisfies the invariant.

### Item ids under linking

Ids are not globally unique today and only matter as the **command-output cache
key** for `custom-command` items (a global `Record<id, string>`). Linked surfaces
hold **identical ids** on purpose: a shared `custom-command` is then computed once
and shown on every linked surface (desirable). The only hazard is _after_ unlink —
two now-independent surfaces would still share a cache key — so **unlink
regenerates the ids** of the detached surface (see TUI). Normalization in
`loadConfig` keeps ids identical across linked members (it deep-clones canonical,
ids included).

## TUI (`packages/tui/src/screens/items.tsx`)

The one shared surface-layout editor. Changes:

### Propagation on edit

`commit(next)` becomes link-aware. If the current surface is linked, build the new
`lines` once and write a **deep clone** (ids preserved) into every linked member,
in a single immutable `setConfig` (clone `surfaces`, replace each member's
`SurfaceLayout.lines`). Non-linked surfaces behave exactly as today. (v1 still
edits `lines[0]` and preserves `lines.slice(1)`; the whole `lines` array is what
propagates, and members' other lines are already identical.)

### `l` — link

In `strip` mode, `l` opens a small destination chooser (a new `mode`, modeled on
the `picker` branch):

- Options: each other surface individually, plus **"all others"**.
- On confirm: if a chosen target already has items, show a **confirm step**
  ("replace <target>'s layout? y/n") — matching the importer's destructive-replace
  care. On yes, set `linked: true` on the current surface and each target, and copy
  the current surface's `lines` (deep clone, ids preserved) into the targets.

### `u` — unlink

If the current surface is linked, `u` clears its `linked` flag and **regenerates
its item ids** (same generator as item creation: `` `${type}-${Date.now()…}-${rand}` ``).
If this leaves fewer than 2 linked surfaces, clear the remaining flag too (dissolve
the group).

### Indicator

When the current surface is linked, the footer shows a linked hint, e.g.
`🔗 linked: band, pane — edits apply to all`, and `l`/`u` appear in the keybinding
row. The strip footer and the top key-comment block are updated.

## Testing

- **core/validate**: linked-surface normalization — (a) divergent linked `lines`
  are synced to canonical with a warning; (b) a lone `linked` flag is dropped with
  a warning; (c) a valid already-identical linked pair/trio round-trips unchanged;
  (d) deep-clone (no shared references between members).
- **tui/items**: (a) `l` → target chooser → copies layout and marks both linked;
  (b) confirm-on-replace when target non-empty; (c) editing a linked surface
  propagates the new `lines` to all members; (d) `u` detaches and regenerates ids;
  (e) unlinking down to one member dissolves the group; (f) ids stay identical
  across linked members after an edit.

## Docs (same change)

- **DECISION.md** — new `DEC-00XX`: add `SurfaceLayout.linked`; mirror-on-write
  with `loadConfig` normalization; chosen over shared-by-reference; link mirrors
  `lines` only (not `enabled`), ids identical across members and regenerated on
  unlink.
- **FLOW-0002** (config edit → shared file → mod reload) — note that an edit to a
  linked surface propagates to its members, and that `loadConfig` enforces the
  linked-identical invariant for both hosts.

## Open questions

None outstanding — keybindings (`l`/`u`), confirm-on-replace, and identical-ids
were confirmed during brainstorming.
