import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['@ccstatus/core'],
  define: { CCSTATUS_VERSION: JSON.stringify(version) },
  clean: true,
});
