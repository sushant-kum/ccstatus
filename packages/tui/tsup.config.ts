import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['@ccstatus/core'],
  clean: true,
});
