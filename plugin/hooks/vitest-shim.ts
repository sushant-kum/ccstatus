// The pure plugin modules (git-parse, snapshot-build, config-io, toasts) import
// their test helpers from 'claude-code/testing' so they run under `claude plugin
// test` (the preview engine). That import isn't resolvable off the engine, so for
// CI we run the SAME test files under vitest by aliasing 'claude-code/testing' to
// this shim (see plugin/vitest.config.ts). Only engine-free modules are included
// there; the engine-integration tests still run only under `claude plugin test`.
export { test, expect } from 'vitest'
