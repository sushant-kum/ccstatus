/* eslint-disable @typescript-eslint/no-explicit-any -- harness boundary: `claude-code/testing` is untyped on disk ($, on, events) */
import { expect, mock, test } from 'claude-code/testing';

import { defaultConfig } from './core.js';

test('once toast fires once while true, and again after re-crossing', async ($, on) => {
  mock.clock(on, { now: 1_000_000 });
  mock.env(on, { HOME: '/h' });
  const cfg = {
    ...defaultConfig,
    surfaces: {
      ...defaultConfig.surfaces,
      toasts: { enabled: true, rules: [{ when: 'ctxPct > 80', text: 'context high', once: true }] },
    },
  };
  let pct = 90;
  const toasts: string[] = [];
  on('session.start', async (_$, e) => ({ cwd: e.cwd }));
  on('command.register', async () => ({ value: { command: 'ccstatus' } }));
  on('fs.read', async () => ({ value: JSON.stringify(cfg) }) as any);
  on('session.cwd', async () => ({ value: '' }));
  on('session.model', async () => ({ value: 'opus' }));
  on('session.version', async () => ({ value: { version: '1.2.3' } }));
  on(
    'session.usage',
    async () =>
      ({
        value: { context: { tokens: 1, percent: pct }, rateLimits: [], startedAt: 0 },
      }) as any
  );
  on('turn.complete', async () => ({ text: '' }));
  on('ui.status', async () => ({ value: undefined }) as any);
  on('ui.toast', async (_$, e) => {
    toasts.push((e as any).text);
    return { value: undefined } as any;
  });
  const turn = (): Promise<unknown> =>
    $.turn.complete({
      answer: '',
      durationMs: 1,
      isAborted: false,
      turnId: 't',
      reason: 'answer',
    } as any);
  await $.session.start({ cwd: '', surface: 'terminal', isInteractive: true });
  await turn();
  expect(toasts).toEqual(['context high']);
  await turn();
  expect(toasts).toHaveLength(1);
  pct = 10;
  await turn();
  pct = 90;
  await turn();
  expect(toasts).toHaveLength(2);
});
