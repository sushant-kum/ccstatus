import type { Config, Item } from './types.js';

// The surfaces that can share a linked layout. Exactly three, so the set of
// surfaces flagged `linked` is one group (two disjoint pairs are impossible) —
// see DEC-0018. A fourth linkable surface would break that reasoning.
export const LINKABLE = ['band', 'statusline', 'pane'] as const;
export type LinkableSurface = (typeof LINKABLE)[number];

type Surfaces = Config['surfaces'];

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The linkable surfaces currently flagged `linked`, in canonical
 * band -> statusline -> pane order.
 * @param surfaces - The surfaces map.
 * @returns        The linked surfaces, canonical first.
 */
export function linkedSurfaces(surfaces: Surfaces): LinkableSurface[] {
  return LINKABLE.filter((name) => surfaces[name].linked);
}

/**
 * Writes `lines` to `surface` and, when it is linked, mirrors them (deep-cloned)
 * to every other linked member, returning a new surfaces map. This is the single
 * chokepoint for the "linked surfaces share one set of lines" invariant on every
 * edit — callers route layout writes through it instead of re-implementing the
 * propagation loop, so no edit can leave a linked group divergent. See DEC-0019.
 * @param surfaces - The current surfaces map (not mutated).
 * @param surface  - The surface whose lines are being written.
 * @param lines    - The new lines for `surface`.
 * @returns        A new surfaces map with `surface` and any linked members updated.
 */
export function writeLinkedLines(
  surfaces: Surfaces,
  surface: LinkableSurface,
  lines: Item[][]
): Surfaces {
  const next: Surfaces = { ...surfaces };
  next[surface] = { ...surfaces[surface], lines };
  if (surfaces[surface].linked) {
    for (const member of LINKABLE) {
      if (member !== surface && surfaces[member].linked) {
        next[member] = { ...surfaces[member], lines: clone(lines) };
      }
    }
  }
  return next;
}

/**
 * Enforces the linked-surface invariant in place: every surface flagged `linked`
 * shares one set of `lines` (only `lines` is mirrored, not `enabled`). A lone flag
 * is not a group and is dropped; divergent linked lines (only reachable via
 * hand-edited JSON) are synced to the first linked surface in
 * band -> statusline -> pane order.
 * @param surfaces - The built surfaces map, mutated in place.
 * @param warn     - Sink for human-readable warnings.
 */
export function normalizeLinks(surfaces: Surfaces, warn: (s: string) => void): void {
  const linked = linkedSurfaces(surfaces);
  if (linked.length < 2) {
    for (const name of linked) {
      delete surfaces[name].linked;
      warn(`dropped lone surface link on "${name}"`);
    }
    return;
  }
  const canonical = linked[0];
  if (!canonical) {
    return;
  }
  const source = JSON.stringify(surfaces[canonical].lines);
  let diverged = false;
  for (const name of linked) {
    if (name === canonical) {
      continue;
    }
    if (JSON.stringify(surfaces[name].lines) !== source) {
      surfaces[name].lines = clone(surfaces[canonical].lines);
      diverged = true;
    }
  }
  if (diverged) {
    warn(`linked surfaces diverged; synced to "${canonical}"`);
  }
}
