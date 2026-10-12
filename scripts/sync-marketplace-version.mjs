#!/usr/bin/env node
// Sync the two nested version fields in `.claude-plugin/marketplace.json`
// (`metadata.version` and every `plugins[].version`) to the root package.json
// version. commit-and-tag-version's JSON updater only bumps a top-level
// `version`, so the marketplace manifest — which has none — is kept in lockstep
// here instead, as a `postbump` step. The replacement is textual to preserve the
// hand-written formatting (JSON.parse/stringify would reflow the whole file);
// the result is validated by re-parsing. See FLOW-0004 / DEC-0016.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const manifestPath = resolve(root, '.claude-plugin/marketplace.json');
const original = readFileSync(manifestPath, 'utf8');

// Every `"version": "..."` in this manifest tracks the release version, so bump
// them all at once while leaving the rest of the file byte-for-byte unchanged.
let replaced = 0;
const updated = original.replace(/("version"\s*:\s*)"[^"]*"/g, (_match, key) => {
  replaced += 1;
  return `${key}"${version}"`;
});

if (replaced === 0) {
  throw new Error(`no "version" field found in ${manifestPath}`);
}

const parsed = JSON.parse(updated);
if (parsed.metadata?.version !== version || parsed.plugins?.some((p) => p.version !== version)) {
  throw new Error(`failed to set every marketplace version to ${version}`);
}

writeFileSync(manifestPath, updated);
