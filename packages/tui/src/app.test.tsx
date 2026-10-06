import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { render } from 'ink-testing-library';
import { expect, test } from 'vitest';

import { App, type ModProbe } from './app.js';
import type { InstallResult, ModStatus } from './mod-status.js';

// Inject a deterministic mod probe so tests never shell out to the real `claude`
// CLI (that would make the suite slow, flaky, and environment-dependent).
const probe = (status: ModStatus, install?: () => Promise<InstallResult>): ModProbe => ({
  detect: async (): Promise<ModStatus> => status,
  install:
    install ??
    (async (): Promise<InstallResult> => ({
      ok: true,
      message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar',
    })),
});
test('App shows the menu and the pinned preview', () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
  const f = lastFrame() ?? '';
  expect(f).toContain('Edit items');
  expect(f).toContain('live preview');
  unmount();
});

const tick = (): Promise<void> => new Promise<void>((r) => setTimeout(r, 30));
test.each(
  ['items', 'themes', 'powerline', 'surfaces', 'defaults', 'preview', 'import'].map(
    (id, i) => [id, i] as const
  )
)('menu entry %s routes to a screen and keeps the pinned preview', async (_id, idx) => {
  const { stdin, lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
  await tick();
  for (let k = 0; k < idx; k++) {
    stdin.write('\u001B[B');
    await tick();
  }
  stdin.write('\r');
  await tick();
  const f = lastFrame() ?? '';
  expect(f).toContain('live preview');
  expect(f).not.toContain('coming soon');
  expect(f).not.toContain('Edit items\n');
  unmount();
});
test('an invalid existing config surfaces a startup warning', async () => {
  const d = mkdtempSync(join(tmpdir(), 'ccs-'));
  mkdirSync(join(d, '.config', 'ccstatus'), { recursive: true });
  writeFileSync(join(d, '.config', 'ccstatus', 'config.json'), '{not json');
  const prevHome = process.env.HOME;
  const prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.HOME = d;
  delete process.env.XDG_CONFIG_HOME;
  try {
    const { lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
    await tick();
    expect(lastFrame()).toContain('not valid JSON');
    unmount();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }
    if (prevXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = prevXdg;
    }
  }
});
test('a failed save is surfaced and does not exit', async () => {
  const prevHome = process.env.HOME;
  const prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.HOME = '/dev/null'; // dir creation under a non-directory fails (ENOTDIR)
  delete process.env.XDG_CONFIG_HOME;
  try {
    const { stdin, lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
    await tick();
    for (let k = 0; k < 7; k++) {
      stdin.write('\u001B[B');
      await tick();
    } // → "Save & quit"
    stdin.write('\r');
    await tick();
    expect(lastFrame()).toContain('Could not save');
    unmount();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }
    if (prevXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = prevXdg;
    }
  }
});
test('preview screen shows w/s controls and cycles them', async () => {
  const { stdin, lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
  await tick();
  for (let k = 0; k < 5; k++) {
    stdin.write('\u001B[B');
    await tick();
  }
  stdin.write('\r');
  await tick();
  expect(lastFrame()).toContain('w width');
  expect(lastFrame()).toContain('s surface');
  stdin.write('s');
  await tick();
  expect(lastFrame()).toContain('statusline');
  stdin.write('w');
  await tick();
  expect(lastFrame()).toContain('120');
  unmount();
});

test('shows an install banner when the mod is absent', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('absent')} />);
  await tick();
  expect(lastFrame()).toContain('mod not installed');
  expect(lastFrame()).toContain('press i');
  unmount();
});
test('shows no mod banner when the mod is installed', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('installed')} />);
  await tick();
  expect(lastFrame()).not.toContain('mod not installed');
  unmount();
});
test('unknown status shows manual instructions and no press-i action', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('unknown')} />);
  await tick();
  expect(lastFrame()).toContain("couldn't check");
  expect(lastFrame()).not.toContain('press i');
  unmount();
});
test('pressing i on the menu installs the mod and shows the reload message', async () => {
  let called = 0;
  const { stdin, lastFrame, unmount } = render(
    <App
      modProbe={probe('absent', async () => {
        called++;
        return {
          ok: true,
          message: 'mod installed — restart Claude Code (or run /reload-plugins) to see the bar',
        };
      })}
    />
  );
  await tick();
  stdin.write('i');
  await tick();
  await tick();
  expect(called).toBe(1);
  expect(lastFrame()).toMatch(/restart Claude Code|reload/i);
  unmount();
});

test('a failed install is shown as an error, not in the success style', async () => {
  const failing = probe('absent', async () => ({
    ok: false,
    message: 'install failed: network down',
  }));
  const { stdin, lastFrame, unmount } = render(<App modProbe={failing} />);
  await tick();
  stdin.write('i');
  await tick();
  await tick();
  const f = lastFrame() ?? '';
  expect(f).toContain('install failed: network down');
  expect(f).toContain('⚠'); // error marker
  expect(f).not.toContain('✓'); // not the success marker
  unmount();
});
test('pressing i does nothing when not on the menu screen', async () => {
  let called = 0;
  const p = probe('absent', async () => {
    called++;
    return { ok: true, message: 'x' };
  });
  const { stdin, unmount } = render(<App modProbe={p} />);
  await tick();
  stdin.write('\r');
  await tick(); // select first menu item → leaves the menu screen
  stdin.write('i');
  await tick();
  await tick();
  expect(called).toBe(0);
  unmount();
});

test('shows an enable hint when the mod is installed but disabled', async () => {
  const { lastFrame, unmount } = render(<App modProbe={probe('disabled')} />);
  await tick();
  expect(lastFrame()).toContain('disabled');
  expect(lastFrame()).toContain('claude plugin enable');
  unmount();
});
test('a rapid double i triggers only one install', async () => {
  let called = 0;
  const p = probe('absent', async () => {
    called++;
    await tick();
    return { ok: true, message: 'mod installed — reload' };
  });
  const { stdin, unmount } = render(<App modProbe={p} />);
  await tick();
  stdin.write('i');
  stdin.write('i'); // two presses before any re-render
  await tick();
  await tick();
  await tick();
  expect(called).toBe(1);
  unmount();
});
