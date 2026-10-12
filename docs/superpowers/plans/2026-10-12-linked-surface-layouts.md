# Linked Surface Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let band/statusline/pane share one item layout, kept in sync live — edit any linked surface and the others update, persisted across sessions.

**Architecture:** Add an optional `linked` flag per surface (`SurfaceLayout.linked`). The surfaces flagged `linked` form one group, held byte-identical by (a) the TUI propagating every edit to all linked members and (b) `loadConfig` normalizing linked surfaces on load. `core.render` and both painters are untouched — each surface still renders its own (identical) `lines`.

**Tech Stack:** TypeScript (strict, NodeNext), zod (core config schema), Ink + ink-testing-library (TUI), Vitest.

**Spec:** [docs/superpowers/specs/2026-10-12-surface-link-design.md](../specs/2026-10-12-surface-link-design.md)

## Global Constraints

- TS is strict: `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `NodeNext`. All local imports use `.js` extensions.
- Every function needs JSDoc (descriptions, no `{type}` tags) and an explicit return type. `any` and non-null `!` are **errors** — in tests too (use `?? []`, `.at(-1)?.[0]`, type guards).
- Module-level `const` arrow helpers need no JSDoc (match existing `wrap`/`isStylable`); module-level `function` declarations do (match `normalizeLinks`).
- **After any `packages/core` change:** run `npm run build:plugin-core` and commit the regenerated `plugin/hooks/core.js` + `plugin/hooks/core.d.ts` (CI drift check + `check-plugin.mjs` gate them). Never hand-edit those two files.
- Commits are **Conventional Commits**; **no AI-attribution** anywhere (DEC-0007).
- **Do not change `core.render`, `toAnsi`, or either painter.** Linking is a config + TUI-edit concern only.
- Link mirrors `lines` only — never `enabled` (independent visibility) or `theme`/`defaults` (already global).
- Linked members hold **identical item ids** on purpose (shared `custom-command` cache); **unlink regenerates ids** of the detached surface.

## Review Focus

- **`u` on a surface that is not linked** → must be a no-op (no `setConfig`, no crash). Pinned in Task 4.
- **Hand-edited JSON with all three surfaces linked but divergent `lines`** → all sync to the canonical (band) layout with a warning. Pinned in Task 1.
- **After unlink, the detached surface's item ids must differ from before** (so a `custom-command` no longer shares a cache key). Pinned in Task 4.
- **Editing a linked surface that has items on more than one line** → the whole `lines` array propagates, keeping members identical. Pinned in Task 2.
- **Linking into a surface that already has items** → a confirm step guards the clobber; `y` applies, `n`/esc cancels. Pinned in Task 3.

---

### Task 1: Core — `SurfaceLayout.linked`, schema, and `loadConfig` normalization

**Files:**

- Modify: `packages/core/src/config/types.ts` (add `linked?` to `SurfaceLayout`)
- Modify: `packages/core/src/config/schema.ts:25-28` (`surfaceLayoutSchema`)
- Modify: `packages/core/src/config/validate.ts:194-205` (`surf` passthrough) and `:209-221` (call `normalizeLinks`)
- Test: `packages/core/src/config/validate.test.ts`

**Interfaces:**

- Consumes: existing `loadConfig(raw) → { config, warnings }`, `clone`, `defaultConfig`.
- Produces: `SurfaceLayout.linked?: boolean`; `loadConfig` now guarantees all linked surfaces share identical `lines`, drops a lone `linked` flag, and warns on divergence.

- [ ] **Step 1: Write the failing tests** — append to `packages/core/src/config/validate.test.ts`:

```ts
test('linked surfaces are synced to the canonical (band) layout on load', () => {
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] },
      statusline: { enabled: true, linked: true, lines: [[{ id: 'b', type: 'cwd' }]] },
      pane: { enabled: true, linked: true, lines: [[{ id: 'c', type: 'git-branch' }]] },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBe(true);
  expect(config.surfaces.band.lines[0]?.[0]?.type).toBe('model'); // band is canonical
  expect(config.surfaces.statusline.lines).toEqual(config.surfaces.band.lines);
  expect(config.surfaces.pane.lines).toEqual(config.surfaces.band.lines);
  expect(warnings.some((w) => w.includes('diverged'))).toBe(true);
});

test('a lone linked flag is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBeUndefined();
  expect(warnings.some((w) => w.includes('lone surface link'))).toBe(true);
});

test('already-identical linked surfaces load without a diverge warning', () => {
  const line = [{ id: 'a', type: 'model' }];
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [line] },
      statusline: { enabled: true, linked: true, lines: [line] },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBe(true);
  expect(config.surfaces.statusline.linked).toBe(true);
  expect(warnings.some((w) => w.includes('diverged'))).toBe(false);
});

test('normalization deep-clones linked lines (no shared references)', () => {
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] },
      pane: { enabled: true, linked: true, lines: [[{ id: 'b', type: 'cwd' }]] },
    },
  };
  const { config } = loadConfig(raw);
  expect(config.surfaces.pane.lines[0]).not.toBe(config.surfaces.band.lines[0]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @ccstatus/core -- validate`
Expected: FAIL (the `linked` field is stripped by the schema, so nothing is linked).

- [ ] **Step 3: Add `linked` to the type** — in `packages/core/src/config/types.ts`, change `SurfaceLayout`:

```ts
export interface SurfaceLayout {
  enabled: boolean;
  lines: Item[][];
  linked?: boolean; // part of the single band/statusline/pane link group
}
```

- [ ] **Step 4: Accept `linked` in the schema** — in `packages/core/src/config/schema.ts`, update `surfaceLayoutSchema`:

```ts
const surfaceLayoutSchema = z.object({
  enabled: z.boolean(),
  lines: z.array(z.array(itemSchema)),
  linked: z.boolean().optional(),
});
```

- [ ] **Step 5: Pass `linked` through and normalize in `loadConfig`** — in `packages/core/src/config/validate.ts`:

Replace the `surf` helper (currently lines 194-205) so it carries the flag:

```ts
const surf = (name: 'band' | 'statusline' | 'pane'): SurfaceLayout => {
  const s = p.surfaces[name];
  if (!s) {
    return clone(defaultConfig.surfaces[name]);
  }
  const layout: SurfaceLayout = {
    enabled: s.enabled,
    lines: s.lines.map((line) =>
      line.map((it) => cleanItem(it, warn)).filter((x): x is Item => x !== null)
    ),
  };
  if (s.linked) {
    layout.linked = true;
  }
  return layout;
};
```

Call `normalizeLinks` just before returning (right after `const config: Config = { ... };`):

```ts
normalizeLinks(config.surfaces, warn);
return { config, warnings };
```

Add this module-level helper (e.g. just below the `clone` definition near line 18):

```ts
const LINKABLE = ['band', 'statusline', 'pane'] as const;

/**
 * Enforces the linked-surface invariant in place: every surface flagged `linked`
 * shares one layout. A lone flag is not a group and is dropped; divergent linked
 * lines (only reachable via hand-edited JSON) are synced to the first linked
 * surface in band -> statusline -> pane order.
 * @param surfaces - The built surfaces map, mutated in place.
 * @param warn     - Sink for human-readable warnings.
 */
function normalizeLinks(surfaces: Config['surfaces'], warn: (s: string) => void): void {
  const linked = LINKABLE.filter((name) => surfaces[name].linked);
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w @ccstatus/core -- validate`
Expected: PASS (all four new tests + the existing suite).

- [ ] **Step 7: Typecheck core**

Run: `npm run typecheck -w @ccstatus/core`
Expected: no errors.

- [ ] **Step 8: Regenerate the committed plugin bundle** (core changed — mandatory)

Run: `npm run build:plugin-core`
Then confirm the bundle now carries the change: `git status --short plugin/hooks/` should list `core.js` / `core.d.ts` as modified.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/config/types.ts packages/core/src/config/schema.ts \
        packages/core/src/config/validate.ts packages/core/src/config/validate.test.ts \
        plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "feat(core): add linked surfaces, mirrored by loadConfig"
```

---

### Task 2: TUI — id/clone helpers and link-aware `commit` (propagation)

**Files:**

- Modify: `packages/tui/src/screens/items.tsx` (add `makeId`/`cloneLines`; reuse `makeId` in the picker at line 155; make `commit` propagate)
- Test: `packages/tui/src/screens/items.test.tsx`

**Interfaces:**

- Consumes: `SurfaceLayout.linked` from Task 1; existing `SURFACES`, `config.surfaces`, `setConfig`.
- Produces: module-level `makeId(type: string): string` and `cloneLines(lines: Item[][]): Item[][]`; `commit` writes to every linked member.

- [ ] **Step 1: Write the failing tests** — append to `packages/tui/src/screens/items.test.tsx`:

```ts
test('editing a linked surface propagates to its linked members', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.band.linked = true;
  base.surfaces.pane.linked = true;
  base.surfaces.pane.lines = structuredClone(base.surfaces.band.lines);
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('x'); // remove the selected band item
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.band.lines[0].length).toBe(len - 1);
  expect(next.surfaces.pane.lines[0]).toEqual(next.surfaces.band.lines[0]);
  expect(next.surfaces.pane.lines[0]).not.toBe(next.surfaces.band.lines[0]); // cloned, not shared
  unmount();
});

test('propagation copies every line, not just line 0', async () => {
  const base = structuredClone(defaultConfig) as Config;
  const extra = [{ id: 'z', type: 'cwd' as const }];
  base.surfaces.band.lines = [structuredClone(base.surfaces.band.lines[0] ?? []), extra];
  base.surfaces.band.linked = true;
  base.surfaces.pane.linked = true;
  base.surfaces.pane.lines = structuredClone(base.surfaces.band.lines);
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('x');
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.pane.lines).toEqual(next.surfaces.band.lines); // both lines identical
  expect(next.surfaces.pane.lines[1]?.[0]?.id).toBe('z');
  unmount();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: FAIL (`pane` is unchanged — `commit` only writes the current surface).

- [ ] **Step 3: Add the helpers and reuse in the picker** — in `packages/tui/src/screens/items.tsx`, below `const wrap = ...` (line 22) add:

```ts
const makeId = (type: string): string =>
  `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const cloneLines = (lines: Item[][]): Item[][] => JSON.parse(JSON.stringify(lines)) as Item[][];
```

Replace the inline id at line 155 (`const id = \`${type}-...\`;`) with:

```ts
const id = makeId(type);
```

- [ ] **Step 4: Make `commit` link-aware** — replace the `commit` arrow (lines 82-87):

```ts
const commit = (next: Item[]): void => {
  const s = config.surfaces[surface];
  const lines = [next, ...s.lines.slice(1)];
  const surfaces = { ...config.surfaces, [surface]: { ...s, lines } };
  if (s.linked) {
    for (const other of SURFACES) {
      if (other !== surface && config.surfaces[other].linked) {
        surfaces[other] = { ...config.surfaces[other], lines: cloneLines(lines) };
      }
    }
  }
  setConfig({ ...config, surfaces });
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: PASS (new tests + existing suite — non-linked surfaces still behave as before).

- [ ] **Step 6: Typecheck the TUI**

Run: `npm run typecheck -w @sushant-kum/ccstatus`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/src/screens/items.tsx packages/tui/src/screens/items.test.tsx
git commit -m "feat(tui): propagate edits across linked surfaces"
```

---

### Task 3: TUI — link action (`l`), destination chooser, confirm-on-replace

**Files:**

- Modify: `packages/tui/src/screens/items.tsx` (state, `applyLink`, `l` handler + `'link'` mode, chooser/confirm UI, footer)
- Test: `packages/tui/src/screens/items.test.tsx`

**Interfaces:**

- Consumes: `makeId`/`cloneLines`/link-aware `commit` from Task 2; `wrap`, `SURFACES`.
- Produces: `applyLink(targets: Surface[]): void` and a `'link'` editor mode. Later tasks rely on `mode` now being `'strip' | 'editor' | 'picker' | 'link'`.

- [ ] **Step 1: Write the failing tests** — append to `packages/tui/src/screens/items.test.tsx`:

```ts
test('l links band to all others, copying the layout and marking linked', async () => {
  const onChange = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Harness initial={defaultConfig} onChange={onChange} />
  );
  await tick();
  stdin.write('l');
  await tick();
  expect(lastFrame()).toContain('Link band layout to');
  stdin.write(DOWN); // statusline -> pane
  stdin.write(DOWN); // pane -> all others
  await tick();
  stdin.write('\r');
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.band.linked).toBe(true);
  expect(next.surfaces.statusline.linked).toBe(true);
  expect(next.surfaces.pane.linked).toBe(true);
  expect(next.surfaces.statusline.lines[0]).toEqual(next.surfaces.band.lines[0]);
  expect(next.surfaces.pane.lines[0]).toEqual(next.surfaces.band.lines[0]);
  unmount();
});

test('linking into a non-empty surface asks to confirm; y applies', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.statusline.lines = structuredClone(base.surfaces.band.lines); // make it non-empty
  const onChange = vi.fn();
  const { lastFrame, stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('l'); // first option is statusline
  await tick();
  stdin.write('\r');
  await tick();
  expect(lastFrame()).toContain('Replace');
  stdin.write('y');
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.statusline.linked).toBe(true);
  unmount();
});

test('confirm can be cancelled with n', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.statusline.lines = structuredClone(base.surfaces.band.lines);
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('l');
  await tick();
  stdin.write('\r'); // choose statusline -> confirm
  await tick();
  stdin.write('n'); // cancel
  await tick();
  expect(onChange).not.toHaveBeenCalled();
  unmount();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: FAIL (`l` does nothing; no "Link ..." UI).

- [ ] **Step 3: Add state and the link helper** — in `items.tsx`, widen the `mode` state and add link state (replace line 74 and add after it):

```ts
const [mode, setMode] = useState<'strip' | 'editor' | 'picker' | 'link'>('strip');
const [linkPick, setLinkPick] = useState(0);
const [confirm, setConfirm] = useState<Surface[] | null>(null);
```

Add, after the `move` helper (around line 140), the destination list and `applyLink`:

```ts
const others = SURFACES.filter((s) => s !== surface);
const linkOptions: { label: string; targets: Surface[] }[] = [
  ...others.map((s) => ({ label: s, targets: [s] })),
  { label: 'all others', targets: others },
];
const applyLink = (targets: Surface[]): void => {
  const srcLines = cloneLines(config.surfaces[surface].lines);
  const surfaces = {
    ...config.surfaces,
    [surface]: { ...config.surfaces[surface], linked: true },
  };
  for (const t of targets) {
    surfaces[t] = { ...config.surfaces[t], linked: true, lines: cloneLines(srcLines) };
  }
  setConfig({ ...config, surfaces });
};
```

- [ ] **Step 4: Handle `l` and the `'link'` mode** — in the `useInput` dispatcher:

In the strip branch (the final `else`), add alongside the other `input ===` checks:

```ts
      } else if (input === 'l') {
        setLinkPick(0);
        setConfirm(null);
        setMode('link');
```

Add a new `else if (mode === 'link')` branch (before the final strip `else`):

```ts
    } else if (mode === 'link') {
      if (confirm) {
        if (input === 'y') {
          applyLink(confirm);
          setConfirm(null);
          setMode('strip');
        } else if (input === 'n' || key.escape) {
          setConfirm(null);
          setMode('strip');
        }
      } else if (key.escape) {
        setMode('strip');
      } else if (key.upArrow) {
        setLinkPick((p) => wrap(p - 1 + linkOptions.length, linkOptions.length));
      } else if (key.downArrow) {
        setLinkPick((p) => wrap(p + 1, linkOptions.length));
      } else if (key.return) {
        const chosen = linkOptions[linkPick];
        if (chosen) {
          const nonEmpty = chosen.targets.some((t) =>
            config.surfaces[t].lines.some((l) => l.length > 0)
          );
          if (nonEmpty) {
            setConfirm(chosen.targets);
          } else {
            applyLink(chosen.targets);
            setMode('strip');
          }
        }
      }
```

- [ ] **Step 5: Render the chooser/confirm UI** — change the body conditional (currently `{mode === 'picker' ? (...) : (cur && ...)}`) so `'link'` is handled first:

```tsx
      {mode === 'link' ? (
        <Box flexDirection="column" marginTop={1}>
          {confirm ? (
            <Text>
              Replace {confirm.join(', ')} layout with {surface}&apos;s? (y/n)
            </Text>
          ) : (
            <>
              <Text bold>Link {surface} layout to:</Text>
              {linkOptions.map((o, i) => (
                <Text key={o.label} color={i === linkPick ? 'cyan' : undefined}>
                  {i === linkPick ? '▸ ' : '  '}
                  {o.label}
                </Text>
              ))}
            </>
          )}
        </Box>
      ) : mode === 'picker' ? (
```

Leave the existing picker block and the trailing `cur && (...)` editor block as the remaining ternary arms (only the opening of the conditional changes).

- [ ] **Step 6: Update the footer hints** — replace the footer `<Text dimColor>` expression (lines 263-269):

```tsx
<Text dimColor>
  {mode === 'strip'
    ? '←/→ select · [/] move · a add · x remove · e edit · l link · u unlink · tab surface · esc back'
    : mode === 'editor'
      ? '↑/↓ field · ←/→ change · esc done'
      : mode === 'link'
        ? confirm
          ? 'y confirm · n cancel'
          : '↑/↓ choose · enter link · esc cancel'
        : '↑/↓ choose · enter add · esc cancel'}
</Text>
```

(The `u unlink` hint is wired in Task 4; adding it here keeps the footer stable.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: PASS.

- [ ] **Step 8: Typecheck the TUI**

Run: `npm run typecheck -w @sushant-kum/ccstatus`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/tui/src/screens/items.tsx packages/tui/src/screens/items.test.tsx
git commit -m "feat(tui): link a surface layout to others"
```

---

### Task 4: TUI — unlink action (`u`) and linked indicator

**Files:**

- Modify: `packages/tui/src/screens/items.tsx` (`applyUnlink`, `u` handler, indicator row)
- Test: `packages/tui/src/screens/items.test.tsx`

**Interfaces:**

- Consumes: `makeId` (Task 2), `SURFACES`, `config.surfaces`, `setConfig`.
- Produces: `applyUnlink(): void` (no-op when the current surface is not linked).

- [ ] **Step 1: Write the failing tests** — append to `packages/tui/src/screens/items.test.tsx`:

```ts
test('u unlinks the surface, regenerates its ids, and dissolves a 2-member group', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.band.linked = true;
  base.surfaces.pane.linked = true;
  base.surfaces.pane.lines = structuredClone(base.surfaces.band.lines);
  const beforeIds = (base.surfaces.band.lines[0] ?? []).map((i) => i.id);
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('u');
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.band.linked).toBe(false);
  expect(next.surfaces.pane.linked).toBe(false); // only pane would remain -> dissolved
  const afterIds = next.surfaces.band.lines[0].map((i: { id: string }) => i.id);
  expect(afterIds).not.toEqual(beforeIds); // ids regenerated
  expect(afterIds.length).toBe(beforeIds.length);
  unmount();
});

test('u on a non-linked surface is a no-op', async () => {
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={defaultConfig} onChange={onChange} />);
  await tick();
  stdin.write('u');
  await tick();
  expect(onChange).not.toHaveBeenCalled();
  unmount();
});

test('a linked surface shows the linked indicator', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.band.linked = true;
  base.surfaces.pane.linked = true;
  base.surfaces.pane.lines = structuredClone(base.surfaces.band.lines);
  const { lastFrame, unmount } = render(<Harness initial={base} onChange={() => {}} />);
  await tick();
  expect(lastFrame()).toContain('linked:');
  unmount();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: FAIL (`u` does nothing; no indicator text).

- [ ] **Step 3: Add `applyUnlink`** — in `items.tsx`, after `applyLink`:

```ts
const applyUnlink = (): void => {
  const layout = config.surfaces[surface];
  if (!layout.linked) {
    return;
  }
  const surfaces = {
    ...config.surfaces,
    [surface]: {
      ...layout,
      linked: false,
      lines: layout.lines.map((line) => line.map((it) => ({ ...it, id: makeId(it.type) }) as Item)),
    },
  };
  const remaining = SURFACES.filter((s) => s !== surface && surfaces[s].linked);
  if (remaining.length === 1) {
    const lone = remaining[0];
    if (lone) {
      surfaces[lone] = { ...surfaces[lone], linked: false };
    }
  }
  setConfig({ ...config, surfaces });
};
```

- [ ] **Step 4: Handle `u`** — in the strip branch of `useInput`, add:

```ts
      } else if (input === 'u') {
        applyUnlink();
```

- [ ] **Step 5: Render the linked indicator** — add just after the surface-tabs `<Box>` (closes near line 227), before the items `<Box>`:

```tsx
{
  config.surfaces[surface].linked && (
    <Text color="magenta">
      🔗 linked: {SURFACES.filter((s) => config.surfaces[s].linked).join(', ')} — edits apply to all
    </Text>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w @sushant-kum/ccstatus -- items`
Expected: PASS.

- [ ] **Step 7: Typecheck the TUI**

Run: `npm run typecheck -w @sushant-kum/ccstatus`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/tui/src/screens/items.tsx packages/tui/src/screens/items.test.tsx
git commit -m "feat(tui): unlink surfaces and show linked indicator"
```

---

### Task 5: Docs — DEC-0018 and FLOW-0002

**Files:**

- Modify: `docs/DECISION.md` (index row + `DEC-0018` entry)
- Modify: `docs/FLOW.md` (`FLOW-0002` — propagation + normalization, bump `Last verified`)

**Interfaces:** none (documentation).

- [ ] **Step 1: Add the DEC-0018 index row** — in `docs/DECISION.md`, after the `DEC-0017` row:

```markdown
| DEC-0018 | 2026-10-12 | Linked surface layouts: a `SurfaceLayout.linked` flag mirrored on write + on load | Accepted | core \| tui |
```

- [ ] **Step 2: Append the DEC-0018 entry** (end of `docs/DECISION.md`):

```markdown
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
- Linked members keep identical item ids (a shared `custom-command` is computed once);
  **unlink regenerates ids** so detached surfaces no longer share a cache key.
- `saveConfigFile` already rounds through `loadConfig`, so the persisted file always
  satisfies the linked-identical invariant, and the mod self-heals hand-edited drift.
```

- [ ] **Step 3: Update FLOW-0002** — in `docs/FLOW.md`, open the `FLOW-0002` entry (config edit → shared file → mod reload). Make three edits:
  1. In its index-table row and the entry's `Last verified:` line, set the date to `2026-10-12`.
  2. Add `[DEC-0018](./DECISION.md#dec-0018--linked-surface-layouts-a-surfacelayoutlinked-flag-mirrored-on-write-and-on-load)` to the entry's **Related:** line.
  3. Add this bullet to the entry's **Branches & failure modes** (or the steps, matching the entry's style):

     ```markdown
     - **Linked surfaces (DEC-0018):** editing a surface flagged `linked` in the TUI
       (`screens/items.tsx`) writes the new `lines` to every linked member in the same
       `setConfig`, and `loadConfig` re-enforces the linked-identical invariant on read,
       so the mod and the TUI always agree on a linked group's layout.
     ```

- [ ] **Step 4: Verify docs quality**

Run: `npm run format:check && npm run cspell`
Expected: PASS (add any new words to `cspell.json` if flagged).

- [ ] **Step 5: Commit**

```bash
git add docs/DECISION.md docs/FLOW.md cspell.json
git commit -m "docs: record linked surfaces (DEC-0018, FLOW-0002)"
```

---

## Final verification (after all tasks)

- [ ] `npm test -w @ccstatus/core` — all core tests pass.
- [ ] `npm test -w @sushant-kum/ccstatus` — all TUI tests pass.
- [ ] `npm run typecheck -w @ccstatus/core && npm run typecheck -w @sushant-kum/ccstatus`.
- [ ] `npm run lint && npm run format:check && npm run cspell && npm run knip` — repo-wide gates green.
- [ ] `npm run build:plugin-core && git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts` — bundle is committed and fresh.
- [ ] `node scripts/check-plugin.mjs` — structural plugin check passes.
