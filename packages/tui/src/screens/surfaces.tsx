import type { ToastRule } from '@ccstatus/core';
import { isValidWhen } from '@ccstatus/core';
import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';
import { TOAST_PRESETS } from '../toast-presets.js';

const SURFACES = ['band', 'statusline', 'pane', 'toasts'] as const;

type Mode =
  | { kind: 'nav' }
  | { kind: 'preset'; idx: number }
  | { kind: 'edit'; target: 'when' | 'text' | 'new'; ruleIdx: number; buf: string };

/**
 * Renders the surfaces screen for toggling surfaces and editing toast rules.
 * @param root0           - The screen props.
 * @param root0.config    - The current config.
 * @param root0.setConfig - Callback to replace the config immutably.
 * @param root0.goHome    - Callback to return to the menu.
 * @returns               The surfaces screen element.
 */
export function Surfaces({ config, setConfig, goHome }: ScreenProps): ReactElement {
  const [focus, setFocus] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'nav' });
  const s = config.surfaces;
  const rules: ToastRule[] = s.toasts.rules;
  const total = SURFACES.length + rules.length;

  const setRules = (next: ToastRule[]): void =>
    setConfig({ ...config, surfaces: { ...s, toasts: { ...s.toasts, rules: next } } });

  // eslint-disable-next-line complexity -- inherent key/mode dispatch for the editor
  useInput((input, key) => {
    if (mode.kind === 'preset') {
      const n = TOAST_PRESETS.length + 1;
      if (key.escape) {
        setMode({ kind: 'nav' });
      } else if (key.upArrow) {
        setMode({ kind: 'preset', idx: (mode.idx + n - 1) % n });
      } else if (key.downArrow) {
        setMode({ kind: 'preset', idx: (mode.idx + 1) % n });
      } else if (key.return) {
        const p = TOAST_PRESETS[mode.idx];
        if (p) {
          setRules([...rules, { when: p.when, text: p.text, once: true }]);
          setFocus(SURFACES.length + rules.length);
          setMode({ kind: 'nav' });
        } else {
          setMode({ kind: 'edit', target: 'new', ruleIdx: -1, buf: '' });
        }
      }
      return;
    }
    if (mode.kind === 'edit') {
      if (key.escape) {
        setMode({ kind: 'nav' });
      } else if (key.return) {
        if (mode.target === 'new') {
          if (!isValidWhen(mode.buf)) {
            return;
          }
          setRules([...rules, { when: mode.buf.trim(), text: 'Custom alert', once: true }]);
          setFocus(SURFACES.length + rules.length);
        } else {
          setRules(
            rules.map((r, i) => (i === mode.ruleIdx ? { ...r, [mode.target]: mode.buf } : r))
          );
        }
        setMode({ kind: 'nav' });
      } else if (key.backspace || key.delete) {
        setMode({ ...mode, buf: mode.buf.slice(0, -1) });
      } else if (
        input &&
        !key.ctrl &&
        !key.meta &&
        !key.upArrow &&
        !key.downArrow &&
        !key.leftArrow &&
        !key.rightArrow &&
        !key.tab
      ) {
        setMode({ ...mode, buf: mode.buf + input });
      }
      return;
    }
    const ruleIdx = focus - SURFACES.length;
    if (key.escape) {
      goHome();
    } else if (key.upArrow) {
      setFocus((f) => Math.max(0, f - 1));
    } else if (key.downArrow) {
      setFocus((f) => Math.min(total - 1, f + 1));
    } else if (input === 'a') {
      setMode({ kind: 'preset', idx: 0 });
    } else if (input === ' ') {
      if (ruleIdx < 0) {
        const name = SURFACES[focus];
        if (name) {
          setConfig({
            ...config,
            surfaces: { ...s, [name]: { ...s[name], enabled: !s[name].enabled } },
          });
        }
      } else if (rules[ruleIdx]) {
        setRules(rules.map((r, i) => (i === ruleIdx ? { ...r, once: !r.once } : r)));
      }
    } else if (ruleIdx >= 0) {
      const r = rules[ruleIdx];
      if (r && input === 'w') {
        setMode({ kind: 'edit', target: 'when', ruleIdx, buf: r.when });
      } else if (r && input === 't') {
        setMode({ kind: 'edit', target: 'text', ruleIdx, buf: r.text });
      } else if (r && input === 'x') {
        setRules(rules.filter((_, i) => i !== ruleIdx));
        setFocus((f) => Math.max(0, f - 1));
      }
    }
  });

  const cur = (i: number): string => (focus === i ? '▸ ' : '  ');
  return (
    <Box flexDirection="column">
      <Text bold>Surfaces</Text>
      {SURFACES.map((name, i) => (
        <Text key={name} color={focus === i ? 'cyan' : undefined}>
          {cur(i)}[{s[name].enabled ? 'x' : ' '}] {name}
        </Text>
      ))}
      <Text bold>Toast rules</Text>
      {rules.length === 0 && <Text dimColor> (none — press a to add)</Text>}
      {rules.map((r, i) => {
        const idx = SURFACES.length + i;
        const ok = isValidWhen(r.when);
        const editing = mode.kind === 'edit' && mode.ruleIdx === i;
        return (
          <Box key={i}>
            <Text color={focus === idx ? 'cyan' : undefined}>{cur(idx)}</Text>
            <Text color={ok ? undefined : 'red'}>
              when: {editing && mode.target === 'when' ? mode.buf + '_' : r.when}
              {ok ? '' : ' ⚠ invalid'}
            </Text>
            <Text color={focus === idx ? 'cyan' : undefined}>
              {'  '}text: {editing && mode.target === 'text' ? mode.buf + '_' : `"${r.text}"`} [
              {r.once ? 'x' : ' '}] once
            </Text>
          </Box>
        );
      })}
      {mode.kind === 'preset' && (
        <Box flexDirection="column">
          <Text bold>Add rule — pick a preset</Text>
          {[...TOAST_PRESETS.map((p) => `${p.label} (${p.when})`), 'Custom…'].map((l, i) => (
            <Text key={l} color={mode.idx === i ? 'cyan' : undefined}>
              {mode.idx === i ? '▸ ' : '  '}
              {l}
            </Text>
          ))}
        </Box>
      )}
      {mode.kind === 'edit' && mode.target === 'new' && (
        <Text>
          when (e.g. ctxPct&gt;80): {mode.buf}_
          {mode.buf && !isValidWhen(mode.buf) ? ' ⚠ invalid' : ''}
        </Text>
      )}
      <Text dimColor>↑/↓ nav · space toggle · a add · w when · t text · x remove · esc back</Text>
    </Box>
  );
}
