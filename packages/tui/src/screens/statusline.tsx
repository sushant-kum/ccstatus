import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { ScreenProps } from '../app.js';
import {
  detectStatusline as detectDefault,
  disableStatusline as disableDefault,
  enableStatusline as enableDefault,
  type EnableResult,
  type SettingsScope,
  type StatuslineInfo,
} from '../statusline-setup.js';

interface StatuslineDeps {
  detect?: (scope: SettingsScope) => StatuslineInfo;
  enable?: (scope: SettingsScope, opts?: { replaceExisting?: boolean }) => EnableResult;
  disable?: (scope: SettingsScope) => EnableResult;
}

/**
 * Renders the native status-line setup screen: shows the detected state and lets
 * the user enable (per scope, confirming a replace) or disable it.
 * @param root0         - The screen props plus injectable setup functions (for tests).
 * @param root0.goHome  - Callback to return to the menu.
 * @param root0.detect  - Injected detector (defaults to the real one).
 * @param root0.enable  - Injected enabler (defaults to the real one).
 * @param root0.disable - Injected disabler (defaults to the real one).
 * @returns             The status-line setup screen element.
 */
export function Statusline({
  goHome,
  detect = (s): StatuslineInfo => detectDefault(s),
  enable = (s, o): EnableResult => enableDefault(s, o),
  disable = (s): EnableResult => disableDefault(s),
}: ScreenProps & StatuslineDeps): ReactElement {
  const [scope] = useState<SettingsScope>('user');
  const [info, setInfo] = useState<StatuslineInfo>(() => detect('user'));
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<SettingsScope | null>(null);

  /**
   * Enables the status line for a scope, asking for confirmation before replacing another.
   * @param s               - The settings scope to write.
   * @param replaceExisting - Whether replacing a different statusLine is already confirmed.
   */
  const doEnable = (s: SettingsScope, replaceExisting: boolean): void => {
    const current = detect(s);
    if (current.state === 'other' && !replaceExisting) {
      setPendingScope(s);
      setMsg(`A different statusLine is set (${current.command ?? '?'}). Press r to replace it.`);
      return;
    }
    const r = enable(s, { replaceExisting });
    setMsg(r.message);
    setPendingScope(null);
    setInfo(detect(s));
  };

  useInput((input, key) => {
    if (key.escape) {
      goHome();
      return;
    }
    if (input === 'u') {
      doEnable('user', false);
    } else if (input === 'p') {
      doEnable('project', false);
    } else if (input === 'r' && pendingScope) {
      doEnable(pendingScope, true);
    } else if (input === 'd') {
      const r = disable(scope);
      setMsg(r.message);
      setInfo(detect(scope));
    }
  });

  const state =
    info.state === 'ours'
      ? 'configured (ccstatus)'
      : info.state === 'other'
        ? `another command: ${info.command ?? '?'}`
        : info.state === 'unknown'
          ? 'settings.json unreadable'
          : 'not configured';

  return (
    <Box flexDirection="column">
      <Text bold>Native status line</Text>
      <Text>Current: {state}</Text>
      <Text dimColor>u: enable (user) · p: enable (project) · d: disable · esc: back</Text>
      {pendingScope && <Text color="yellow">r: confirm replace</Text>}
      {msg && <Text color="cyan">{msg}</Text>}
    </Box>
  );
}
