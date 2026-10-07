import { loadConfig } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Statusline } from './statusline.js';

const noop = (): void => {
  /* no-op */
};
const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 20));

describe('Statusline screen', () => {
  it('shows the current detected state', () => {
    const detect = vi.fn(() => ({ state: 'absent' as const }));
    const { lastFrame } = render(
      <Statusline
        config={loadConfig(undefined).config}
        setConfig={noop}
        goHome={noop}
        detect={detect}
        enable={vi.fn()}
        disable={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('Native status line');
    expect(lastFrame()?.toLowerCase()).toContain('not configured');
  });

  it('enables for the user scope on "u"', async () => {
    const enable = vi.fn(() => ({ ok: true, message: 'ok' }));
    const { stdin } = render(
      <Statusline
        config={loadConfig(undefined).config}
        setConfig={noop}
        goHome={noop}
        detect={vi.fn(() => ({ state: 'absent' as const }))}
        enable={enable}
        disable={vi.fn()}
      />
    );
    await tick();
    stdin.write('u');
    expect(enable).toHaveBeenCalledWith('user', expect.anything());
  });
});
