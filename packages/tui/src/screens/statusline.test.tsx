import { loadConfig } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import type { StatuslineInfo } from '../statusline-setup.js';

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

  /**
   * Renders the screen with the given detector and spies.
   * @param detect - Detector stub.
   * @returns      The spies and stdin.
   */
  function setup(detect: () => StatuslineInfo): {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    goHome: ReturnType<typeof vi.fn>;
    stdin: { write: (s: string) => void };
  } {
    const enable = vi.fn(() => ({ ok: true, message: 'ok' }));
    const disable = vi.fn(() => ({ ok: true, message: 'off' }));
    const goHome = vi.fn();
    const { stdin } = render(
      <Statusline
        config={loadConfig(undefined).config}
        setConfig={noop}
        goHome={goHome}
        detect={vi.fn(detect)}
        enable={enable}
        disable={disable}
      />
    );
    return { enable, disable, goHome, stdin };
  }

  it('asks before replacing another statusLine, then replaces on "r"', async () => {
    const { enable, stdin } = setup(() => ({ state: 'other', command: 'x.sh' }));
    await tick();
    stdin.write('u');
    expect(enable).not.toHaveBeenCalled();
    await tick();
    stdin.write('r');
    expect(enable).toHaveBeenCalledWith('user', { replaceExisting: true });
  });

  it('enables project scope on "p"', async () => {
    const { enable, stdin } = setup(() => ({ state: 'absent' }));
    await tick();
    stdin.write('p');
    expect(enable).toHaveBeenCalledWith('project', expect.anything());
  });

  it('disables the active scope on "d"', async () => {
    const { disable, stdin } = setup(() => ({ state: 'absent' }));
    await tick();
    stdin.write('p');
    await tick();
    stdin.write('d');
    expect(disable).toHaveBeenCalledWith('project');
  });

  it('does not allow r after d clears a pending replace', async () => {
    const { enable, stdin } = setup(() => ({ state: 'other', command: 'x.sh' }));
    await tick();
    stdin.write('u');
    await tick();
    stdin.write('d');
    await tick();
    stdin.write('r');
    expect(enable).not.toHaveBeenCalled();
  });

  it('returns home on escape', async () => {
    const { goHome, stdin } = setup(() => ({ state: 'absent' }));
    await tick();
    stdin.write('\u001B');
    await tick();
    expect(goHome).toHaveBeenCalled();
  });
});
