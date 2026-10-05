#!/usr/bin/env node
// Structural validation of the ccstatus mod, with no dependency on the `claude`
// CLI. The mod uses the function-hooks ("modules") plugin format, which only the
// preview claude build understands — the public `claude plugin validate` rejects
// it — so CI checks the manifest, hooks wiring, and committed core bundle here.
// Run `claude plugin validate`/`claude plugin test` locally (preview CLI) for the
// full engine check. See FLOW-0004 / DEC-0010.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Node runs this .mjs; TS return types are invalid JS
const fail = (m) => errors.push(m);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Node runs this .mjs; TS return types are invalid JS
const readJson = (rel) => {
  const p = resolve(root, rel);
  if (!existsSync(p)) {
    fail(`missing ${rel}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${rel} is not valid JSON: ${e.message}`);
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Node runs this .mjs; TS return types are invalid JS
const nonEmptyFile = (rel) => {
  const p = resolve(root, rel);
  if (!existsSync(p)) {
    fail(`missing ${rel}`);
    return false;
  }
  if (statSync(p).size === 0) {
    fail(`${rel} is empty`);
    return false;
  }
  return true;
};

// 1. plugin manifest
const manifest = readJson('plugin/.claude-plugin/plugin.json');
if (manifest) {
  for (const k of ['name', 'version', 'description']) {
    if (typeof manifest[k] !== 'string' || !manifest[k]) {
      fail(`plugin.json: "${k}" must be a non-empty string`);
    }
  }
  if (manifest.name !== 'ccstatus') {
    fail(`plugin.json: name should be "ccstatus", got ${JSON.stringify(manifest.name)}`);
  }
}

// 2. hooks wiring (function-hooks format)
const hooks = readJson('plugin/hooks/hooks.json');
if (hooks) {
  if (!Array.isArray(hooks.modules) || hooks.modules.length === 0) {
    fail('hooks.json: "modules" must be a non-empty array');
  } else {
    for (const m of hooks.modules) {
      if (typeof m !== 'string') {
        fail(`hooks.json: module entry ${JSON.stringify(m)} is not a string`);
        continue;
      }
      if (!existsSync(resolve(root, 'plugin/hooks', m))) {
        fail(`hooks.json: module "${m}" does not exist`);
      }
    }
  }
}

// 3. committed core bundle (so git/marketplace installs can load the mod — DEC-0010)
nonEmptyFile('plugin/hooks/core.js');
nonEmptyFile('plugin/hooks/core.d.ts');

// 4. marketplace manifest points at ./plugin
const mp = readJson('.claude-plugin/marketplace.json');
if (mp) {
  const entry = Array.isArray(mp.plugins)
    ? mp.plugins.find((p) => p && p.name === 'ccstatus')
    : null;
  if (!entry) {
    fail('marketplace.json: no plugin entry named "ccstatus"');
  } else if (entry.source !== './plugin') {
    fail(
      `marketplace.json: ccstatus source should be "./plugin", got ${JSON.stringify(entry.source)}`
    );
  }
}

if (errors.length) {
  console.error(`✘ plugin structure check failed (${errors.length}):`);
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}
// eslint-disable-next-line no-console -- CLI stdout output: the success line is this script's normal stdout report
console.log('✔ plugin structure OK (manifest, hooks modules, core bundle, marketplace entry)');
