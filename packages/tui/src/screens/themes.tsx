import { asIndex, indexToHex } from '@ccstatus/core';
import type { ColorIndex, PaletteSlot, Theme } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { Fragment, useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';

// list: ↑/↓ select · ⏎ activate · → slots · n new · d duplicate · esc home
// slots: ↑/↓ slot · ←/→ fg/bg · ⏎ pick · a add slot · x remove slot · esc back
// picker: ↑/↓ row · ←/→ swatch · ⏎ set · esc cancel
// Pickable sequence: the 6x6x6 colour cube (16-231) then the 24-step grayscale ramp (232-255).
export const PICK_INDICES: ColorIndex[] = Array.from({ length: 240 }, (_, i) => asIndex(16 + i));
// Display grid: rows 0-5 show the 6 cube blocks side by side (36 swatches wide); row 6 is the ramp
// (24 wide); row 7 is the single (none) entry that clears the field.
const CUBE_ROWS = 6;
const CUBE_WIDTH = 36;
const RAMP_ROW = 6;
const RAMP_WIDTH = 24;
const NONE_ROW = 7;
const FIELDS = ['fg', 'bg'] as const;

interface PickPos {
  row: number;
  col: number;
}

/**
 * Returns the number of swatches in a picker row.
 * @param row - The picker row.
 * @returns   The row width (1 for the (none) row).
 */
const rowWidth = (row: number): number =>
  row < CUBE_ROWS ? CUBE_WIDTH : row === RAMP_ROW ? RAMP_WIDTH : 1;

/**
 * Maps a picker grid position to its position in PICK_INDICES (undefined for the (none) row).
 * @param pos     - The grid position.
 * @param pos.row - The picker row.
 * @param pos.col - The swatch column within the row.
 * @returns       The index into PICK_INDICES, or undefined for (none).
 */
export const posToPick = ({ row, col }: PickPos): number | undefined => {
  if (row >= NONE_ROW) {
    return undefined;
  }
  if (row === RAMP_ROW) {
    return 216 + col;
  }
  return 36 * Math.floor(col / 6) + 6 * row + (col % 6);
};

/**
 * Maps a color index to its picker grid position (the (none) row when unset or out of range).
 * @param idx - The current color index, if any.
 * @returns   The grid position to start the cursor on.
 */
const indexToPos = (idx: ColorIndex | undefined): PickPos => {
  if (idx === undefined || idx < 16 || idx > 255) {
    return { row: NONE_ROW, col: 0 };
  }
  const p = idx - 16;
  if (p >= 216) {
    return { row: RAMP_ROW, col: p - 216 };
  }
  return { row: Math.floor((p % 36) / 6), col: Math.floor(p / 36) * 6 + (p % 6) };
};

/**
 * Moves the picker cursor one step, clamping within the grid.
 * @param pos - The current position.
 * @param dr  - Row delta.
 * @param dc  - Column delta.
 * @returns   The new position.
 */
const movePos = (pos: PickPos, dr: number, dc: number): PickPos => {
  const row = Math.max(0, Math.min(NONE_ROW, pos.row + dr));
  const col = Math.max(0, Math.min(rowWidth(row) - 1, pos.col + dc));
  return { row, col };
};

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
  const [pick, setPick] = useState<PickPos>({ row: NONE_ROW, col: 0 });

  const name = names[Math.min(sel, names.length - 1)];
  const theme: Theme = (name && config.themes[name]) || [];
  const count = theme.length;
  const slotIdx = Math.min(slot, count - 1);

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
        setPick(indexToPos(cur));
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
        setPick((p) => movePos(p, -1, 0));
      } else if (key.downArrow) {
        setPick((p) => movePos(p, 1, 0));
      } else if (key.leftArrow) {
        setPick((p) => movePos(p, 0, -1));
      } else if (key.rightArrow) {
        setPick((p) => movePos(p, 0, 1));
      } else if (key.return && slotIdx >= 0) {
        const f = FIELDS[field] ?? 'fg';
        const pi = posToPick(pick);
        const chosen = pi === undefined ? undefined : PICK_INDICES[pi];
        const entry: PaletteSlot = { ...theme[slotIdx] };
        if (chosen === undefined) {
          delete entry[f];
        } else {
          entry[f] = chosen;
        }
        writeSlot(slotIdx, entry);
        setMode('slots');
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
            <Text
              color={c.fg === undefined ? undefined : indexToHex(c.fg)}
              inverse={on && field === 0}
            >
              {' '}
              {c.fg === undefined ? '(none)' : `idx ${c.fg}`}{' '}
            </Text>
            <Text
              backgroundColor={c.bg === undefined ? undefined : indexToHex(c.bg)}
              inverse={on && field === 1}
            >
              {' '}
              {c.bg === undefined ? '(none)' : `idx ${c.bg}`}{' '}
            </Text>
          </Text>
        );
      })}
      {mode === 'picker' && (
        <Box flexDirection="column">
          <Text bold>
            Pick {FIELDS[field]} for slot {slotIdx}
          </Text>
          {Array.from({ length: RAMP_ROW + 1 }, (_, row) => (
            <Text key={row}>
              {Array.from({ length: rowWidth(row) }, (_, col) => {
                const pi = posToPick({ row, col });
                const idx = pi === undefined ? undefined : PICK_INDICES[pi];
                const on = pick.row === row && pick.col === col;
                return (
                  <Fragment key={col}>
                    <Text
                      backgroundColor={idx === undefined ? undefined : indexToHex(idx)}
                      inverse={on}
                    >
                      {on ? '◆ ' : '  '}
                    </Text>
                    {row < CUBE_ROWS && col % 6 === 5 ? ' ' : ''}
                  </Fragment>
                );
              })}
            </Text>
          ))}
          <Text color={pick.row === NONE_ROW ? 'cyan' : undefined}>
            {pick.row === NONE_ROW ? '▸ ' : '  '}(none)
          </Text>
          <Text dimColor>
            {((): string => {
              const pi = posToPick(pick);
              return pi === undefined ? 'none' : `idx ${PICK_INDICES[pi]}`;
            })()}
          </Text>
        </Box>
      )}
      <Text dimColor>
        {mode === 'list'
          ? '↑/↓ select · ⏎ activate · → slots · n new · d duplicate · esc back'
          : mode === 'slots'
            ? '↑/↓ slot · ←/→ fg/bg · ⏎ pick · a add · x remove · esc back'
            : '↑/↓ row · ←/→ swatch · ⏎ set · esc cancel'}
      </Text>
    </Box>
  );
}
