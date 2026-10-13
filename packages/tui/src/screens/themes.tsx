import type { PaletteSlot, Theme } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';
import { NAMED_COLORS } from '../named-colors.js';
import { inkBg, inkColor } from '../paint.js';

// list: ↑/↓ select · ⏎ activate · → slots · n new · d duplicate · esc home
// slots: ↑/↓ slot · ←/→ fg/bg · ⏎ pick · a add slot · x remove slot · esc back
// picker: ↑/↓ · ⏎ set · esc cancel
// NAMED_COLORS already begins with '(none)', so FG keeps it; the bg filter drops it, so BG re-adds it.
const FG = NAMED_COLORS.filter((c) => !c.startsWith('bg'));
const BG = ['(none)', ...NAMED_COLORS.filter((c) => c.startsWith('bg'))];
const FIELDS = ['fg', 'bg'] as const;

/**
 * Returns a theme name unique within the given map, suffixing -2, -3, ... As needed..
 * @param base   - The desired base name.
 * @param themes - The existing themes keyed by name.
 * @returns      A name not already present in the map.
 */
function uniqueName(base: string, themes: Record<string, Theme>): string {
  if (!(base in themes)) {
    return base;
  }
  let i = 2;
  while (`${base}-${i}` in themes) {
    i++;
  }
  return `${base}-${i}`;
}

/**
 * Renders the themes screen for selecting, creating, and recoloring themes.
 * @param root0           - The screen props.
 * @param root0.config    - The current config.
 * @param root0.setConfig - Callback to replace the config immutably.
 * @param root0.goHome    - Callback to return to the menu.
 * @returns               The themes screen element.
 */
export function Themes({ config, setConfig, goHome }: ScreenProps): ReactElement {
  const names = Object.keys(config.themes);
  const [sel, setSel] = useState(Math.max(0, names.indexOf(config.theme)));
  const [mode, setMode] = useState<'list' | 'slots' | 'picker'>('list');
  const [slot, setSlot] = useState(0);
  const [field, setField] = useState(0);
  const [pick, setPick] = useState(0);

  const name = names[Math.min(sel, names.length - 1)];
  const theme: Theme = (name && config.themes[name]) || [];
  const count = theme.length;
  const slotIdx = Math.min(slot, count - 1);
  const list = FIELDS[field] === 'fg' ? FG : BG;

  const setThemes = (themes: Record<string, Theme>, active = config.theme): void =>
    setConfig({ ...config, theme: active, themes });

  const writeSlot = (index: number, entry: PaletteSlot): void => {
    if (name) {
      setThemes({ ...config.themes, [name]: theme.map((s, i) => (i === index ? entry : s)) });
    }
  };

  // eslint-disable-next-line complexity -- inherent key/mode dispatch for the theme editor
  useInput((input, key) => {
    if (mode === 'list') {
      if (key.escape) {
        goHome();
      } else if (key.upArrow) {
        setSel((s) => Math.max(0, s - 1));
      } else if (key.downArrow) {
        setSel((s) => Math.min(names.length - 1, s + 1));
      } else if (key.return) {
        if (name) {
          setConfig({ ...config, theme: name });
        }
      } else if (key.rightArrow) {
        if (count) {
          setSlot(0);
          setMode('slots');
        }
      } else if (input === 'n') {
        const n = uniqueName('custom', config.themes);
        setThemes({ ...config.themes, [n]: [] });
        setSel(names.length);
      } else if (input === 'd' && name) {
        const n = uniqueName(`${name}-copy`, config.themes);
        setThemes({ ...config.themes, [n]: structuredClone(theme) });
        setSel(names.length);
      }
    } else if (mode === 'slots') {
      if (key.escape || (key.leftArrow && field === 0)) {
        setMode('list');
      } else if (key.upArrow) {
        setSlot(Math.max(0, slotIdx - 1));
      } else if (key.downArrow) {
        setSlot(Math.min(count - 1, slotIdx + 1));
      } else if (key.leftArrow) {
        setField(0);
      } else if (key.rightArrow) {
        setField(1);
      } else if (key.return && slotIdx >= 0) {
        const cur = theme[slotIdx]?.[FIELDS[field] ?? 'fg'];
        setPick(Math.max(0, list.indexOf(cur ?? '(none)')));
        setMode('picker');
      } else if (input === 'a' && name) {
        setThemes({ ...config.themes, [name]: [...theme, {}] });
        setSlot(count);
      } else if (input === 'x' && name && slotIdx >= 0) {
        const next = theme.filter((_, i) => i !== slotIdx);
        setThemes({ ...config.themes, [name]: next });
        if (next.length === 0) {
          setMode('list');
        } else {
          setSlot(Math.min(slotIdx, next.length - 1));
        }
      }
    } else {
      if (key.escape) {
        setMode('slots');
      } else if (key.upArrow) {
        setPick((p) => Math.max(0, p - 1));
      } else if (key.downArrow) {
        setPick((p) => Math.min(list.length - 1, p + 1));
      } else if (key.return && slotIdx >= 0) {
        const f = FIELDS[field] ?? 'fg';
        const chosen = list[pick];
        if (chosen) {
          const entry: PaletteSlot = { ...theme[slotIdx] };
          if (chosen === '(none)') {
            delete entry[f];
          } else {
            entry[f] = chosen;
          }
          writeSlot(slotIdx, entry);
          setMode('slots');
        }
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Themes</Text>
      {names.map((n, i) => (
        <Text key={n} color={i === sel && mode === 'list' ? 'cyan' : undefined}>
          {i === sel ? '▸ ' : '  '}
          {n}
          {n === config.theme ? ' (active)' : ''}
        </Text>
      ))}
      <Text dimColor>{name} palette slots:</Text>
      {count === 0 && <Text dimColor>(empty palette)</Text>}
      {theme.map((c, i) => {
        const on = mode !== 'list' && i === slotIdx;
        return (
          <Text key={i}>
            {on ? '▸ ' : '  '}
            {String(i).padEnd(4)}
            <Text color={inkColor(c.fg)} inverse={on && field === 0}>
              {' '}
              {c.fg ?? '(none)'}{' '}
            </Text>
            <Text backgroundColor={inkBg(c.bg)} inverse={on && field === 1}>
              {' '}
              {c.bg ?? '(none)'}{' '}
            </Text>
          </Text>
        );
      })}
      {mode === 'picker' && (
        <Box flexDirection="column">
          <Text bold>
            Pick {FIELDS[field]} for slot {slotIdx}
          </Text>
          {list.map((c, i) => (
            <Text key={c} color={i === pick ? 'cyan' : undefined}>
              {i === pick ? '▸ ' : '  '}
              <Text
                color={FIELDS[field] === 'fg' ? inkColor(c) : undefined}
                backgroundColor={FIELDS[field] === 'bg' ? inkBg(c) : undefined}
              >
                {' '}
                {c}{' '}
              </Text>
            </Text>
          ))}
        </Box>
      )}
      <Text dimColor>
        {mode === 'list'
          ? '↑/↓ select · ⏎ activate · → slots · n new · d duplicate · esc back'
          : mode === 'slots'
            ? '↑/↓ slot · ←/→ fg/bg · ⏎ pick · a add · x remove · esc back'
            : '↑/↓ choose · ⏎ set · esc cancel'}
      </Text>
    </Box>
  );
}
