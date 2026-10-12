#!/usr/bin/env node
// Runs the commit-and-tag-version `postbump` steps with per-step labels, so a
// mid-chain failure names the step that aborted the release instead of leaving a
// bare `&&`-chain error. Wired from `.versionrc.json` `scripts.postbump`; the
// resulting file changes are staged by the `postchangelog` `git add -A` and folded
// into the release commit (`commitAll`). See FLOW-0004 / DEC-0016.
import { execSync } from 'node:child_process';

const steps = [
  ['regenerate core bundle', 'npm run build:plugin-core'],
  ['sync marketplace version', 'node scripts/sync-marketplace-version.mjs'],
  ['re-sync package-lock', 'npm install --package-lock-only --ignore-scripts'],
];

for (const [label, cmd] of steps) {
  process.stdout.write(`→ postbump: ${label}...\n`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    process.stderr.write(`✖ release postbump failed at: ${label} — \`${cmd}\`\n`);
    process.exit(1);
  }
}
