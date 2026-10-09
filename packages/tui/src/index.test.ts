import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const bin = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const BUILD_TIMEOUT_MS = 120_000;

describe('ccstatus statusline bin', () => {
  beforeAll(() => {
    // Always rebuild so the test never runs against a stale or missing dist/.
    execFileSync('npm', ['run', 'build', '-w', '@sushant-kum/ccstatus'], {
      cwd: repoRoot,
      stdio: 'ignore',
      timeout: BUILD_TIMEOUT_MS,
    });
  }, BUILD_TIMEOUT_MS);

  it('exits 0 and prints nothing when there is no live snapshot', () => {
    const out = execFileSync('node', [bin, 'statusline'], {
      env: { ...process.env, HOME: '/nonexistent-ccstatus-test-home', XDG_CONFIG_HOME: '' },
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(out).toBe('');
  });
});
