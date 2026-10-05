import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Runs ONLY the engine-free plugin modules' tests in CI (the same files also run
// under `claude plugin test`). 'claude-code/testing' is aliased to a vitest shim so
// the files need no change. Engine-integration tests (band/pane/statusline/
// toast-wiring/reload) are intentionally excluded — they need the function-hooks
// harness and run only under the preview `claude plugin test`. See FLOW-0004.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), // the plugin/ directory
  resolve: {
    alias: {
      'claude-code/testing': fileURLToPath(new URL('./hooks/vitest-shim.ts', import.meta.url)),
    },
  },
  test: {
    include: ['hooks/config-io.test.ts', 'hooks/snapshot-build.test.ts', 'hooks/toasts.test.ts'],
  },
});
