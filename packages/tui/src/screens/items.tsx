import { registry } from '@ccstatus/core';
import type { Align, Config, Item, ItemStyle, StylableItem, WidgetType } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState, type ReactElement, type ReactNode } from 'react';

import type { ScreenProps } from '../app.js';
import { NAMED_COLORS } from '../named-colors.js';
import { inkBg, inkColor } from '../paint.js';

// Keys — strip: ←/→ select · [ / ] move item left/right · a add · x remove · e edit · tab surface · esc home
//        editor: ↑/↓ field · ←/→ change · esc back to strip
//        picker: ↑/↓ choose · enter add · esc cancel
// v1 operates on line 0 of each surface (existing extra lines are preserved untouched).
const SURFACES = ['band', 'statusline', 'pane'] as const;
type Surface = (typeof SURFACES)[number];
const FIELDS = ['fg', 'bg', 'raw', 'merge', 'align'] as const;
const ALIGNS: Align[] = ['left', 'center', 'right'];
const FG = NAMED_COLORS.filter((c) => !c.startsWith('bg'));
const BG = ['(none)', ...NAMED_COLORS.filter((c) => c.startsWith('bg'))];
const WIDGETS = Object.values(registry) as { type: WidgetType; label: string }[];

const wrap = (i: number, n: number): number => (i + n) % n;

// The flex separator carries no styling; everything else is a StylableItem.
const isStylable = (item: Item): item is StylableItem => item.type !== 'flex-separator';

/**
 * Renders a single item chip in the strip, highlighted when selected.
 * @param root0          - The chip props.
 * @param root0.item     - The item to render.
 * @param root0.selected - Whether this chip is selected.
 * @returns              The chip element.
 */
function Chip({ item, selected }: { item: Item; selected: boolean }): ReactElement {
  const fg = isStylable(item) ? item.fg : undefined;
  const bg = isStylable(item) ? item.bg : undefined;
  return (
    <Text inverse={selected} color={inkColor(fg)} backgroundColor={inkBg(bg)}>
      [ {item.type} ]
    </Text>
  );
}

/**
 * Renders a color swatch for a named color, or a dimmed placeholder when unset.
 * @param root0      - The swatch props.
 * @param root0.name - The color name, if any.
 * @param root0.bg   - Whether the color is a background color.
 * @returns          The swatch element.
 */
function Swatch({ name, bg }: { name?: string; bg?: boolean }): ReactElement {
  if (!name) {
    return <Text dimColor>(none)</Text>;
  }
  return (
    <Text color={bg ? undefined : inkColor(name)} backgroundColor={bg ? inkBg(name) : undefined}>
      {' '}
      {name}{' '}
    </Text>
  );
}

/**
 * Renders the items screen for adding, ordering, styling, and removing items.
 * @param root0           - The screen props.
 * @param root0.config    - The current config.
 * @param root0.setConfig - Callback to replace the config immutably.
 * @param root0.goHome    - Callback to return to the menu.
 * @returns               The items screen element.
 */
export function Items({ config, setConfig, goHome }: ScreenProps): ReactElement {
  const [surface, setSurface] = useState<Surface>('band');
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<'strip' | 'editor' | 'picker'>('strip');
  const [field, setField] = useState(0);
  const [pick, setPick] = useState(0);

  const items: Item[] = config.surfaces[surface].lines[0] ?? [];
  const cur = items[Math.min(sel, items.length - 1)];
  const idx = cur ? items.indexOf(cur) : -1;

  const commit = (next: Item[]): void => {
    const s = config.surfaces[surface];
    const lines = [next, ...s.lines.slice(1)];
    const c: Config = { ...config, surfaces: { ...config.surfaces, [surface]: { ...s, lines } } };
    setConfig(c);
  };
  // Style edits only apply to stylable items (never the flex separator).
  const patch = (p: Partial<ItemStyle>): void => {
    const base = items[idx];
    if (idx < 0 || !base || !isStylable(base)) {
      return;
    }
    const item = { ...base, ...p } as StylableItem;
    for (const k of Object.keys(p) as (keyof ItemStyle)[]) {
      if (item[k] === undefined) {
        delete item[k];
      }
    }
    commit(items.map((it, i) => (i === idx ? item : it)));
  };
  const cycleColor = (list: string[], cur: string | undefined, dir: 1 | -1): string | undefined => {
    const n =
      list[wrap(Math.max(0, list.indexOf(cur ?? '(none)')) + dir + list.length, list.length)] ??
      '(none)';
    return n === '(none)' ? undefined : n;
  };
  const change = (dir: 1 | -1): void => {
    if (!cur || !isStylable(cur)) {
      return;
    }
    const f = FIELDS[field];
    if (f === 'fg') {
      patch({ fg: cycleColor(FG, cur.fg, dir) });
    } else if (f === 'bg') {
      patch({ bg: cycleColor(BG, cur.bg, dir) });
    } else if (f === 'raw') {
      patch({ rawValue: !cur.rawValue });
    } else if (f === 'merge') {
      patch({ merge: !cur.merge });
    } else {
      patch({ align: ALIGNS[wrap(ALIGNS.indexOf(cur.align ?? 'left') + dir + 3, 3)] ?? 'left' });
    }
  };
  const move = (dir: 1 | -1): void => {
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) {
      return;
    }
    const next = [...items];
    const a = next[idx];
    const b = next[j];
    if (a === undefined || b === undefined) {
      return;
    }
    next[idx] = b;
    next[j] = a;
    commit(next);
    setSel(j);
  };

  // eslint-disable-next-line complexity -- inherent key/mode dispatch for the strip editor
  useInput((input, key) => {
    if (mode === 'picker') {
      if (key.escape) {
        setMode('strip');
      } else if (key.upArrow) {
        setPick((p) => wrap(p - 1 + WIDGETS.length, WIDGETS.length));
      } else if (key.downArrow) {
        setPick((p) => wrap(p + 1, WIDGETS.length));
      } else if (key.return) {
        const picked = WIDGETS[pick];
        if (picked) {
          const type = picked.type;
          const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          const newItem: Item =
            type === 'custom-text'
              ? { id, type, text: '' }
              : type === 'custom-command'
                ? { id, type, command: '' }
                : type === 'flex-separator'
                  ? { id, type }
                  : { id, type };
          commit([...items, newItem]);
          setSel(items.length);
          setMode('strip');
        }
      }
    } else if (mode === 'editor') {
      if (key.escape) {
        setMode('strip');
      } else if (key.upArrow) {
        setField((f) => Math.max(0, f - 1));
      } else if (key.downArrow) {
        setField((f) => Math.min(FIELDS.length - 1, f + 1));
      } else if (key.leftArrow) {
        change(-1);
      } else if (key.rightArrow) {
        change(1);
      }
    } else {
      if (key.escape) {
        goHome();
      } else if (key.tab) {
        setSurface((s) => SURFACES[wrap(SURFACES.indexOf(s) + 1, SURFACES.length)] ?? s);
        setSel(0);
      } else if (key.leftArrow) {
        setSel(Math.max(0, idx - 1));
      } else if (key.rightArrow) {
        setSel(Math.min(items.length - 1, idx + 1));
      } else if (input === '[') {
        move(-1);
      } else if (input === ']') {
        move(1);
      } else if (input === 'a') {
        setPick(0);
        setMode('picker');
      } else if (input === 'x' && idx >= 0) {
        commit(items.filter((_, i) => i !== idx));
        setSel(Math.max(0, idx - 1));
      } else if (input === 'e' && idx >= 0) {
        setField(0);
        setMode('editor');
      }
    }
  });

  const row = (i: number, name: string, value: ReactNode): ReactElement => (
    <Box key={name}>
      <Text color={mode === 'editor' && field === i ? 'cyan' : undefined}>
        {mode === 'editor' && field === i ? '▸ ' : '  '}
        {name}:{' '}
      </Text>
      {value}
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box>
        {SURFACES.map((s) => (
          <Text key={s} bold={s === surface} color={s === surface ? 'cyan' : undefined}>
            {' '}
            {s === surface ? `[${s}]` : s}{' '}
          </Text>
        ))}
      </Box>
      <Box>
        {items.length === 0 ? (
          <Text dimColor>(no items — press a)</Text>
        ) : (
          items.map((it, i) => <Chip key={it.id} item={it} selected={i === idx} />)
        )}
      </Box>
      {mode === 'picker' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Add widget</Text>
          {WIDGETS.map((w, i) => (
            <Text key={w.type} color={i === pick ? 'cyan' : undefined}>
              {i === pick ? '▸ ' : '  '}
              {w.type} <Text dimColor>{w.label}</Text>
            </Text>
          ))}
        </Box>
      ) : (
        cur &&
        (isStylable(cur) ? (
          <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
            <Text>type: {cur.type}</Text>
            {row(0, 'fg', <Swatch name={cur.fg} />)}
            {row(1, 'bg', <Swatch name={cur.bg} bg />)}
            {row(2, 'raw', <Text>{cur.rawValue ? 'on' : 'off'}</Text>)}
            {row(3, 'merge', <Text>{cur.merge ? 'on' : 'off'}</Text>)}
            {row(4, 'align', <Text>{cur.align ?? 'left'}</Text>)}
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
            <Text>type: {cur.type}</Text>
            <Text dimColor>(flex separator — no style options)</Text>
          </Box>
        ))
      )}
      <Text dimColor>
        {mode === 'strip'
          ? '←/→ select · [/] move · a add · x remove · e edit · tab surface · esc back'
          : mode === 'editor'
            ? '↑/↓ field · ←/→ change · esc done'
            : '↑/↓ choose · enter add · esc cancel'}
      </Text>
    </Box>
  );
}
