import { readFileSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig({
  // Mirror tsup's build-time define so VERSION resolves in tests too.
  define: { CCSTATUS_VERSION: JSON.stringify(version) },
  test: { include: ['src/**/*.test.tsx', 'src/**/*.test.ts'] },
});
