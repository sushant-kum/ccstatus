import type { Theme } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';
import { NAMED_COLORS } from '../named-colors.js';
import { inkBg, inkColor } from '../paint.js';

// list: ↑/↓ select · ⏎ activate · → colors · n new · d duplicate · esc home
// colors: ↑/↓ widget · ←/→ fg/bg · ⏎ pick · esc back      picker: ↑/↓ · ⏎ set · esc cancel
const FG = NAMED_COLORS.filter((c) => !c.startsWith('bg'));
const BG = NAMED_COLORS.filter((c) => c.startsWith('bg'));
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
  const [mode, setMode] = useState<'list' | 'colors' | 'picker'>('list');
  const [w, setW] = useState(0);
  const [field, setField] = useState(0);
  const [pick, setPick] = useState(0);

  const name = names[Math.min(sel, names.length - 1)];
  const theme: Theme = (name && config.themes[name]) || {};
  const widgets = Object.keys(theme);
  const widget = widgets[Math.min(w, widgets.length - 1)];
  const list = FIELDS[field] === 'fg' ? FG : BG;

  const setThemes = (themes: Record<string, Theme>, active = config.theme): void =>
    setConfig({ ...config, theme: active, themes });

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
        if (widgets.length) {
          setW(0);
          setMode('colors');
        }
      } else if (input === 'n') {
        const n = uniqueName('custom', config.themes);
        setThemes({ ...config.themes, [n]: {} });
        setSel(names.length);
      } else if (input === 'd' && name) {
        const n = uniqueName(`${name}-copy`, config.themes);
        setThemes({ ...config.themes, [n]: structuredClone(theme) });
        setSel(names.length);
      }
    } else if (mode === 'colors') {
      if (key.escape || (key.leftArrow && field === 0)) {
        setMode('list');
      } else if (key.upArrow) {
        setW((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setW((i) => Math.min(widgets.length - 1, i + 1));
      } else if (key.leftArrow) {
        setField(0);
      } else if (key.rightArrow) {
        setField(1);
      } else if (key.return && widget) {
        const cur = theme[widget]?.[FIELDS[field] ?? 'fg'];
        setPick(Math.max(0, list.indexOf(cur ?? '')));
        setMode('picker');
      }
    } else {
      if (key.escape) {
        setMode('colors');
      } else if (key.upArrow) {
        setPick((p) => Math.max(0, p - 1));
      } else if (key.downArrow) {
        setPick((p) => Math.min(list.length - 1, p + 1));
      } else if (key.return && name && widget) {
        const f = FIELDS[field] ?? 'fg';
        const chosen = list[pick];
        if (chosen) {
          const entry = { ...theme[widget], [f]: chosen };
          setThemes({ ...config.themes, [name]: { ...theme, [widget]: entry } });
          setMode('colors');
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
      <Text dimColor>{name} colors:</Text>
      {widgets.map((wt, i) => {
        const c = theme[wt] ?? {};
        const on = mode !== 'list' && i === w;
        return (
          <Text key={wt}>
            {on ? '▸ ' : '  '}
            {wt.padEnd(20)}
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
            Pick {FIELDS[field]} for {widget}
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
          ? '↑/↓ select · ⏎ activate · → colors · n new · d duplicate · esc back'
          : mode === 'colors'
            ? '↑/↓ widget · ←/→ fg/bg · ⏎ pick · esc back'
            : '↑/↓ choose · ⏎ set · esc cancel'}
      </Text>
    </Box>
  );
}
