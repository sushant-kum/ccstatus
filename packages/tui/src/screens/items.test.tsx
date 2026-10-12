import { defaultConfig } from '@ccstatus/core';
import type { Config } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { useState, type ReactElement } from 'react';
import { expect, test, vi } from 'vitest';

import { Items } from './items.js';

const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 20));
/**
 * Wraps Items in local state so edits round-trip through a real setConfig.
 * @param root0          - The harness props.
 * @param root0.initial  - The initial config.
 * @param root0.onChange - Called with each new config the screen produces.
 * @returns              The wrapped Items element.
 */
function Harness({
  initial,
  onChange,
}: {
  initial: Config;
  onChange: (c: Config) => void;
}): ReactElement {
  const [c, setC] = useState(initial);
  return (
    <Items
      config={c}
      setConfig={(n) => {
        setC(n);
        onChange(n);
      }}
      goHome={() => {
        /* no-op */
      }}
    />
  );
}
const DOWN = '\u001B[B',
  RIGHT = '\u001B[C';
const len = defaultConfig.surfaces.band.lines[0]?.length ?? 0;

test('lists the band items and can remove one', async () => {
  const setConfig = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Items
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  expect(lastFrame()).toContain('version');
  expect(lastFrame()).toContain('model');
  stdin.write('x');
  await tick();
  const next = setConfig.mock.calls.at(-1)?.[0];
  expect(next.surfaces.band.lines[0].length).toBe(len - 1);
  expect(defaultConfig.surfaces.band.lines[0]?.length).toBe(len);
  unmount();
});

test('a opens the picker; enter adds a new item', async () => {
  const setConfig = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Items
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('a');
  await tick();
  expect(lastFrame()).toContain('Add widget');
  stdin.write('\u001B[B');
  await tick();
  stdin.write('\r');
  await tick();
  const next = setConfig.mock.calls.at(-1)?.[0];
  const line = next.surfaces.band.lines[0];
  expect(line.length).toBe(len + 1);
  expect(line.at(-1).id).toMatch(/^[a-z0-9-]+-[a-z0-9]+$/);
  unmount();
});

test('] reorders the selected item right', async () => {
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Items
      config={defaultConfig}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write(']');
  await tick();
  const ids = defaultConfig.surfaces.band.lines[0]?.map((i) => i.id) ?? [];
  const got = setConfig.mock.calls
    .at(-1)?.[0]
    .surfaces.band.lines[0].map((i: { id: string }) => i.id);
  expect(got).toEqual([ids[1], ids[0], ...ids.slice(2)]);
  unmount();
});

test('e edits: ↓ to raw, → toggles rawValue; tab switches surface; esc home', async () => {
  const setConfig = vi.fn(),
    goHome = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Items config={defaultConfig} setConfig={setConfig} goHome={goHome} />
  );
  await tick();
  stdin.write('e');
  await tick();
  stdin.write('\u001B[B');
  await tick();
  stdin.write('\u001B[B');
  await tick();
  stdin.write('\u001B[C');
  await tick();
  expect(setConfig.mock.calls.at(-1)?.[0].surfaces.band.lines[0][0].rawValue).toBe(true);
  stdin.write('\u001B');
  await tick();
  await new Promise((r) => setTimeout(r, 50));
  expect(goHome).not.toHaveBeenCalled(); // esc leaves editor first
  stdin.write('\t');
  await tick();
  expect(lastFrame()).toContain('statusline');
  unmount();
});

test('fg and bg cycle to a color, then back to (none) which removes the key', async () => {
  for (const [downs, key] of [
    [0, 'fg'],
    [1, 'bg'],
  ] as const) {
    let last!: Config;
    const { stdin, unmount } = render(
      <Harness
        initial={defaultConfig}
        onChange={(c) => {
          last = c;
        }}
      />
    );
    await tick();
    stdin.write('e');
    await tick();
    for (let i = 0; i < downs; i++) {
      stdin.write(DOWN);
      await tick();
    }
    // defaults give item 0 a fg/bg; cycle forward until it wraps to (none)
    let guard = 0;
    while (
      (last?.surfaces.band.lines[0]?.[0] as Record<string, unknown> | undefined)?.[key] !==
        undefined ||
      guard === 0
    ) {
      stdin.write(RIGHT);
      await tick();
      expect(++guard).toBeLessThan(60);
    }
    const item0 = (): Record<string, unknown> =>
      (last.surfaces.band.lines[0]?.[0] ?? {}) as Record<string, unknown>;
    expect('fg' in item0() && key === 'fg').toBe(false);
    expect(key in item0()).toBe(false);
    stdin.write(RIGHT);
    await tick();
    expect(item0()[key]).toBeDefined();
    unmount();
  }
});

test('editing line 0 preserves lines[1]', async () => {
  const extra = { id: 'cwd-x', type: 'cwd' as const };
  const cfg: Config = {
    ...defaultConfig,
    surfaces: {
      ...defaultConfig.surfaces,
      band: {
        ...defaultConfig.surfaces.band,
        lines: [defaultConfig.surfaces.band.lines[0] ?? [], [extra]],
      },
    },
  };
  const setConfig = vi.fn();
  const { stdin, unmount } = render(
    <Items
      config={cfg}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  stdin.write('x');
  await tick();
  const next = setConfig.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.band.lines.length).toBe(2);
  expect(next.surfaces.band.lines[1]).toEqual([extra]);
  unmount();
});

test('empty line: x, e, → do not throw', async () => {
  const cfg: Config = {
    ...defaultConfig,
    surfaces: { ...defaultConfig.surfaces, band: { ...defaultConfig.surfaces.band, lines: [[]] } },
  };
  const setConfig = vi.fn();
  const { lastFrame, stdin, unmount } = render(
    <Items
      config={cfg}
      setConfig={setConfig}
      goHome={() => {
        /* no-op */
      }}
    />
  );
  await tick();
  for (const k of ['x', 'e', RIGHT]) {
    stdin.write(k);
    await tick();
  }
  expect(lastFrame()).toContain('no items');
  expect(setConfig).not.toHaveBeenCalled();
  unmount();
});

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
  expect(next.surfaces.band.lines[0]?.length).toBe(len - 1);
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
  const afterIds = (next.surfaces.band.lines[0] ?? []).map((i: { id: string }) => i.id);
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
  const { lastFrame, unmount } = render(<Harness initial={base} onChange={vi.fn()} />);
  await tick();
  expect(lastFrame()).toContain('linked:');
  unmount();
});

test('linking into a pre-existing group syncs the whole group to the source', async () => {
  const base = structuredClone(defaultConfig) as Config;
  base.surfaces.band.linked = true;
  base.surfaces.statusline.linked = true;
  base.surfaces.statusline.lines = structuredClone(base.surfaces.band.lines);
  base.surfaces.pane.lines = [[{ id: 'p', type: 'cwd' as const }]];
  const onChange = vi.fn();
  const { stdin, unmount } = render(<Harness initial={base} onChange={onChange} />);
  await tick();
  stdin.write('\t'); // band -> statusline
  stdin.write('\t'); // statusline -> pane
  await tick();
  stdin.write('l'); // chooser for pane: [band, statusline, all others]
  await tick();
  stdin.write(DOWN); // band -> statusline
  await tick();
  stdin.write('\r'); // statusline non-empty -> confirm
  await tick();
  stdin.write('y');
  await tick();
  const next = onChange.mock.calls.at(-1)?.[0] as Config;
  expect(next.surfaces.pane.linked).toBe(true);
  expect(next.surfaces.pane.lines[0]?.[0]?.type).toBe('cwd'); // source wins
  expect(next.surfaces.band.lines).toEqual(next.surfaces.pane.lines);
  expect(next.surfaces.statusline.lines).toEqual(next.surfaces.pane.lines);
  unmount();
});
