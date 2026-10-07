import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const bin = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('ccstatus statusline bin', () => {
  it('exits 0 and prints nothing when there is no live snapshot', () => {
    const out = execFileSync('node', [bin, 'statusline'], {
      env: { ...process.env, HOME: '/nonexistent-ccstatus-test-home', XDG_CONFIG_HOME: '' },
      encoding: 'utf8',
    });
    expect(out).toBe('');
  });
});
