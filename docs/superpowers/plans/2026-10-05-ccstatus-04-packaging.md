# ccstatus Phase 4 — Packaging & Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ccstatus installable by the public — `npx ccstatus` for the TUI and a Claude Code marketplace entry for the mod — with a root README, MIT license, and CI, without actually publishing in this phase.

**Architecture:** Five surfaces of distribution config are added around the existing, finished code. The TUI (`packages/tui`) is renamed from `@ccstatus/tui` to the unscoped npm name `ccstatus` and its bundled-core build is made install-safe (core moves out of runtime deps). The mod (`plugin/`) is exposed through a root `.claude-plugin/marketplace.json`, and its generated core bundle is committed so a git/marketplace install can load it. A GitHub Actions workflow runs the per-workspace test/typecheck/build commands plus `claude plugin validate` and a core-bundle freshness check. No `npm publish` and no marketplace release happen in this phase.

**Tech Stack:** npm workspaces, tsup (TUI + plugin-core bundling), vitest, `claude` CLI (plugin validate/test), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-04-ccstatus-design.md` (Distribution section; Build sequence step 5).

## Global Constraints

- **No publishing in this phase.** No `npm publish`, no `claude plugin marketplace`/release side effects left behind; probes that mutate local state (e.g. `marketplace add`) must be reverted in the same task.
- **`@ccstatus/core` stays private and is never published to npm** — it is a non-goal in the spec (`packages/core/package.json` keeps `"private": true`). Both consumers _bundle_ core, they do not depend on a published core.
- **No AI attribution** anywhere in code, files, commits, or PRs — no "Generated with", no `Co-Authored-By: Claude`, no session links (DEC-0007).
- **Node floor is `>=20`** (`packages/tui/package.json` `engines`); the published `ccstatus` and CI must honor it.
- **Root `npm run typecheck` (`tsc -b`) is broken** (no root project references) — CI and all verification use the per-workspace `npm run typecheck -w <pkg>`, never the root one.
- **v1 colors are named terminal colors only** (DEC-0005) — nothing in docs/README should promise hex.
- **Docs travel with the change** — any decision or flow introduced here is written into `docs/DECISION.md` / `docs/FLOW.md` and `CLAUDE.md` in the same task (Task 7), per the repo's doc policy.
- **License/author identity:** MIT, author `Sushant Kumar`, repo `https://github.com/sushant-kum/ccstatus`, year `2026`.

## Review Focus

These are failure modes the spec implies but that no feature test exercises; each gets its test/verification pinned to the task that owns it.

- **Installed `ccstatus` can't resolve `@ccstatus/core` at runtime** — if core stays in `dependencies`, `npm install ccstatus` tries to fetch a private, unpublished package and fails. Owned by **Task 2** (verify a packed tarball runs with no `@ccstatus/core` on disk).
- **Marketplace-installed mod fails to load because the core bundle is absent** — `plugin/hooks/core.js` is gitignored/generated, but a git/marketplace install reads the repo as-is. Owned by **Task 5** (commit the bundle; CI drift check).
- **Published tarball leaks source/tests or omits the bin** — a wrong `files`/bin field ships `src/` or a non-executable entry. Owned by **Task 2** (`npm pack --dry-run` contents assertion; shebang + exec bit).
- **marketplace.json is malformed** so `claude plugin marketplace add` rejects the repo. Owned by **Task 3** (add-then-remove probe against the real repo path).
- **CI green while the committed core bundle is stale** — a core change lands without rerunning `build:plugin-core`, so the mod runs old core but CI passes. Owned by **Task 5** (rebuild + `git diff --exit-code` step).

---

### Task 1: License and author/repository metadata

Fills the `claude plugin validate` "No author information" warning and establishes the MIT license and repo identity used by both published halves.

**Files:**

- Create: `LICENSE`
- Modify: `plugin/.claude-plugin/plugin.json`
- Modify: `package.json` (root — add `repository`, `license`, `author`)

**Interfaces:**

- Produces: a committed `LICENSE` (MIT), and `plugin.json` with `author`/`homepage`/`license`/`keywords` fields consumed by Task 3's marketplace entry and Task 4's README badges.

- [ ] **Step 1: Write `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 Sushant Kumar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Add author/license/keywords to `plugin/.claude-plugin/plugin.json`**

Replace the file with:

```json
{
  "name": "ccstatus",
  "version": "0.1.0",
  "description": "A configurable status bar for Claude Code — band, status line, pane, and toasts driven by one config; configured with npx ccstatus or /ccstatus.",
  "author": { "name": "Sushant Kumar", "url": "https://github.com/sushant-kum" },
  "homepage": "https://github.com/sushant-kum/ccstatus",
  "license": "MIT",
  "keywords": ["claude-code", "statusline", "status-bar", "plugin", "mod"],
  "types": "./types/index.d.ts"
}
```

- [ ] **Step 3: Add identity fields to root `package.json`**

Add these keys to the existing root `package.json` object (keep `private`, `workspaces`, `scripts`, `devDependencies` as-is):

```json
  "license": "MIT",
  "author": "Sushant Kumar",
  "repository": { "type": "git", "url": "git+https://github.com/sushant-kum/ccstatus.git" },
  "homepage": "https://github.com/sushant-kum/ccstatus#readme",
  "bugs": { "url": "https://github.com/sushant-kum/ccstatus/issues" }
```

- [ ] **Step 4: Verify the author warning is gone**

Run: `claude plugin validate plugin 2>&1 | grep -i author || echo "NO AUTHOR WARNING"`
Expected: prints `NO AUTHOR WARNING` (the `❯ author: No author information provided` line is gone); overall still `Validation passed`.

- [ ] **Step 5: Commit**

```bash
git add LICENSE plugin/.claude-plugin/plugin.json package.json
git commit -m "chore(release): add MIT LICENSE and author/repository metadata"
```

---

### Task 2: Rename the TUI to the unscoped `ccstatus` npm package and make it install-safe

The published package must be named `ccstatus` (so `npx ccstatus` works), must not declare the private `@ccstatus/core` as a runtime dependency (it is bundled by tsup), and must ship only the built bin + README.

**Files:**

- Modify: `packages/tui/package.json`
- Create: `packages/tui/README.md`
- Verify against: `packages/tui/tsup.config.ts` (already `noExternal: ['@ccstatus/core']` — do not change)

**Interfaces:**

- Consumes: the existing tsup build that inlines `@ccstatus/core` into `dist/index.js`.
- Produces: an npm package named `ccstatus`, bin `ccstatus` → `./dist/index.js`, with `@ccstatus/core` moved to `devDependencies`. Task 3/4/7 refer to the package as `ccstatus` (e.g. `npm test -w ccstatus`).

- [ ] **Step 1: Rewrite `packages/tui/package.json`**

```json
{
  "name": "ccstatus",
  "version": "0.1.0",
  "description": "Interactive configurator (npx ccstatus) for the ccstatus Claude Code status bar — band, status line, pane, and threshold toasts from one config.",
  "license": "MIT",
  "author": "Sushant Kumar",
  "homepage": "https://github.com/sushant-kum/ccstatus#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/sushant-kum/ccstatus.git",
    "directory": "packages/tui"
  },
  "bugs": { "url": "https://github.com/sushant-kum/ccstatus/issues" },
  "keywords": ["claude-code", "statusline", "status-bar", "tui", "ink", "ccstatusline"],
  "engines": { "node": ">=20" },
  "type": "module",
  "bin": { "ccstatus": "./dist/index.js" },
  "files": ["dist", "README.md"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "ink": "^5.0.0", "react": "^18.3.0" },
  "devDependencies": {
    "@ccstatus/core": "*",
    "ink-testing-library": "^4.0.0",
    "@types/react": "^18.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

(`@ccstatus/core` moved from `dependencies` to `devDependencies`: it is bundled, so it must not be resolved at install; the workspace symlink still satisfies it at build/test time.)

- [ ] **Step 2: Write `packages/tui/README.md`** (shown on the npm page)

````markdown
# ccstatus

Interactive configurator for the **ccstatus** status bar for Claude Code.

```bash
npx ccstatus
```
````

Edit one JSON config that drives four surfaces — the above-prompt band, the
native status line, an openable pane, and threshold toasts — with a live
preview rendered by the same engine the mod uses, so the preview matches what
you'll see in Claude Code.

The companion mod is installed from the Claude Code marketplace — see the
[project README](https://github.com/sushant-kum/ccstatus#readme).

MIT © Sushant Kumar

````

- [ ] **Step 3: Reinstall workspaces so the rename is linked, then build**

Run: `npm install && npm run build -w ccstatus`
Expected: install succeeds; `packages/tui/dist/index.js` is emitted with a `#!/usr/bin/env node` shebang.

- [ ] **Step 4: Verify tests still pass under the new package name**

Run: `npm test -w ccstatus`
Expected: 52 pass (unchanged).

- [ ] **Step 5: Write the failing packaging assertion — pack contents**

Run: `npm pack -w ccstatus --dry-run 2>&1 | tee /tmp/ccstatus-pack.txt`
Expected contents: the listing includes `dist/index.js` and `README.md` and **does not** include `src/` or `*.test.*`. If `src/` appears, the `files` field is wrong — fix it before continuing.

- [ ] **Step 6: Verify the packed bin runs with NO `@ccstatus/core` resolvable (the Review-Focus install test)**

```bash
set -e
TARBALL=$(npm pack -w ccstatus --silent --pack-destination /tmp)
WORK=$(mktemp -d)
tar -xzf "/tmp/$TARBALL" -C "$WORK"
# install ONLY the real runtime deps (ink, react) — no workspace, so @ccstatus/core is absent
( cd "$WORK/package" && npm install --omit=dev --no-package-lock ink@^5 react@^18 >/dev/null 2>&1 )
# importing the entry must not throw "Cannot find module '@ccstatus/core'"
node --input-type=module -e "import('$WORK/package/dist/index.js').then(()=>console.error('IMPORTED-OK')).catch(e=>{console.error('IMPORT-FAILED:',e.message);process.exit(1)})" 2>&1 | grep -E 'IMPORTED-OK|IMPORT-FAILED' || true
rm -rf "$WORK" "/tmp/$TARBALL"
````

Expected: prints `IMPORTED-OK`. (If the module tries to render Ink to a non-TTY it may warn, but it must not fail with a missing `@ccstatus/core`.) If it prints `IMPORT-FAILED: Cannot find module '@ccstatus/core'`, core is not bundled / still a runtime dep — fix Step 1 / tsup before continuing.

- [ ] **Step 7: Commit**

```bash
git add packages/tui/package.json packages/tui/README.md package-lock.json
git commit -m "feat(release): publish the TUI as the unscoped \`ccstatus\` npm package"
```

---

### Task 3: Root marketplace manifest for the mod

Exposes `plugin/` through a repo-root `.claude-plugin/marketplace.json` so users can `claude plugin marketplace add sushant-kum/ccstatus` and install.

**Files:**

- Create: `.claude-plugin/marketplace.json`

**Interfaces:**

- Consumes: `plugin/.claude-plugin/plugin.json` (Task 1) at `source: "./plugin"`.
- Produces: a marketplace named `ccstatus` with one plugin entry `ccstatus`, referenced by Task 4's README install steps.

- [ ] **Step 1: Write `.claude-plugin/marketplace.json`**

```json
{
  "name": "ccstatus",
  "owner": { "name": "Sushant Kumar", "url": "https://github.com/sushant-kum" },
  "metadata": {
    "description": "A configurable status bar for Claude Code — band, status line, pane, and threshold toasts from one config.",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "ccstatus",
      "source": "./plugin",
      "description": "A configurable status bar for Claude Code; configure it with npx ccstatus or /ccstatus.",
      "version": "0.1.0",
      "author": { "name": "Sushant Kumar", "url": "https://github.com/sushant-kum" },
      "homepage": "https://github.com/sushant-kum/ccstatus",
      "license": "MIT",
      "keywords": ["claude-code", "statusline", "status-bar"]
    }
  ]
}
```

- [ ] **Step 2: Verify the manifest parses against the real repo (add-then-remove probe)**

```bash
claude plugin marketplace add "$(pwd)" 2>&1 | tee /tmp/ccmp.txt
grep -q "Successfully added marketplace: ccstatus" /tmp/ccmp.txt && echo "MARKETPLACE-OK"
claude plugin marketplace remove ccstatus 2>&1 | grep -q "Successfully removed" && echo "CLEANED-UP"
```

Expected: prints `MARKETPLACE-OK` then `CLEANED-UP`. (The probe must leave no `ccstatus` marketplace configured — confirm with `claude plugin marketplace list | grep -c ccstatus` → `0`.)

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(release): add root marketplace.json exposing the ccstatus mod"
```

---

### Task 4: Root README

The front door: what ccstatus is, install for both halves, the four surfaces, config location, and a demo placeholder.

**Files:**

- Create: `README.md` (repo root)

**Interfaces:**

- Consumes: the `npx ccstatus` package name (Task 2) and the marketplace name (Task 3).

- [ ] **Step 1: Write `README.md`**

````markdown
# ccstatus

A configurable status bar for Claude Code — the mod-system analog of
[ccstatusline](https://github.com/sirmalloc/ccstatusline). One JSON config
drives **four surfaces** — the above-prompt band, the native status line, an
openable pane, and threshold toasts — edited with an interactive TUI and
rendered live by a Claude Code mod. The TUI preview and the mod paint from the
same engine, so what you preview is what you get.

> **Status:** v1, pre-release (`0.1.0`). Not yet published to npm or a hosted
> marketplace — install from source as below.

## Install

ccstatus has two halves that share one config file.

### 1. The mod (renders the bar)

```bash
claude plugin marketplace add sushant-kum/ccstatus
claude plugin install ccstatus@ccstatus
```

Then `/ccstatus` toggles the band; `/ccstatus pane | reload | theme <name> | edit`
cover the rest.

### 2. The configurator (edits the config)

```bash
npx ccstatus
```

An interactive TUI with a live band preview on every screen. Changes are saved
to the shared config file and the running mod hot-reloads them.

## The four surfaces

- **Band** — a status row above the prompt.
- **Status line** — the native Claude Code status line.
- **Pane** — an openable panel with the full bar.
- **Toasts** — threshold alerts (e.g. context % over a limit).

All four are driven by the same config and the same 20 widgets (model,
context length/%, tokens, git branch/changes/worktree, session clock, cost,
rate limits, block timer, cwd, custom text/command, flex separator, …), with
9 built-in themes and a configurable Powerline separator.

## Configuration

One JSON file at `$XDG_CONFIG_HOME/ccstatus/config.json` (else
`~/.config/ccstatus/config.json`), shared by the mod and the TUI. It is
hand-editable: invalid input never crashes either half — it degrades with a
warning. Colors are the named terminal palette (v1; no hex yet).

## Demo

_A demo gif will be added here (`docs/demo.gif`)._

## Development

npm-workspaces monorepo: `@ccstatus/core` (pure engine), `ccstatus` (the TUI
bin), and `plugin/` (the mod). See [`CLAUDE.md`](./CLAUDE.md) and the
decision/flow records under [`docs/`](./docs).

```bash
npm install
npm test -w @ccstatus/core
npm test -w ccstatus
npm run build:plugin-core && claude plugin test plugin
```

## License

MIT © Sushant Kumar
````

- [ ] **Step 2: Verify intra-repo links resolve**

Run: `for f in CLAUDE.md docs/DECISION.md docs/FLOW.md docs; do test -e "$f" && echo "ok $f" || echo "MISSING $f"; done`
Expected: all `ok` (no `MISSING`).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(release): add root README with install for both halves"
```

---

### Task 5: Commit the plugin core bundle for distribution + freshness guarantee

A git/marketplace install reads `plugin/` as-is, but `plugin/hooks/core.js` and `core.d.ts` are generated and gitignored (DEC-0003), so an installed mod would have no core to import. Ship the bundle in the repo and make CI fail if it drifts from `@ccstatus/core`.

**Files:**

- Modify: `.gitignore` (un-ignore the two generated plugin files)
- Add (now tracked): `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`

**Interfaces:**

- Consumes: `npm run build:plugin-core` (root script, already present).
- Produces: a committed, in-repo core bundle that marketplace installs can load; a reproducible `build:plugin-core` whose output is byte-identical on re-run (verified in CI, Task 6).

- [ ] **Step 1: Rebuild the bundle from current core**

Run: `npm run build:plugin-core`
Expected: `plugin/hooks/core.js` (~141 KB) and `plugin/hooks/core.d.ts` are (re)written; build success.

- [ ] **Step 2: Un-ignore the two generated files in `.gitignore`**

Remove the lines that ignore `plugin/hooks/core.js` and `plugin/hooks/core.d.ts`. If they are covered by a broader pattern, add explicit un-ignore lines at the end:

```gitignore
# Distributed with the mod (generated by `npm run build:plugin-core`; kept in sync by CI).
!plugin/hooks/core.js
!plugin/hooks/core.d.ts
```

- [ ] **Step 3: Verify the files are now tracked and the tree matches a fresh build**

Run: `git add plugin/hooks/core.js plugin/hooks/core.d.ts && npm run build:plugin-core && git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts && echo "BUNDLE-FRESH"`
Expected: prints `BUNDLE-FRESH` (a rebuild produces no diff — the committed bundle is reproducible and current).

- [ ] **Step 4: Verify the plugin still validates and tests with the tracked bundle**

Run: `claude plugin validate plugin 2>&1 | tail -1 && claude plugin test plugin 2>&1 | tail -3`
Expected: `Validation passed with warnings`; `29 pass`, `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore plugin/hooks/core.js plugin/hooks/core.d.ts
git commit -m "build(release): commit the plugin core bundle so marketplace installs can load it"
```

---

### Task 6: CI workflow

Runs the real per-workspace commands on push/PR, plus plugin validation and the core-bundle drift check.

**Files:**

- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: root `npm ci`, `npm test -w <pkg>`, `npm run typecheck -w <pkg>`, `npm run build -w ccstatus`, `npm run build:plugin-core`, `claude plugin validate plugin`.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci

      # core
      - run: npm run typecheck -w @ccstatus/core
      - run: npm test -w @ccstatus/core

      # tui (published as `ccstatus`)
      - run: npm run typecheck -w ccstatus
      - run: npm test -w ccstatus
      - run: npm run build -w ccstatus

      # plugin core bundle must be committed AND current
      - name: Core bundle is fresh
        run: |
          npm run build:plugin-core
          git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts \
            || { echo "::error::plugin/hooks/core.{js,d.ts} is stale — run 'npm run build:plugin-core' and commit"; exit 1; }

  plugin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build:plugin-core
      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code
      - name: Validate plugin (static)
        run: claude plugin validate plugin
```

> Note: `claude plugin validate` is static and needs no auth. `claude plugin test`
> is intentionally **not** in CI (it loads the engine and is covered locally);
> the root `tsc -b` typecheck is **not** used (it is broken — see CLAUDE.md).

- [ ] **Step 2: Verify the YAML parses and every command it runs works locally**

Run:

```bash
node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); require('child_process'); console.log(/jobs:/.test(y)&&/build-test:/.test(y)&&/plugin:/.test(y)?'YAML-SHAPE-OK':'BAD')"
npm run typecheck -w @ccstatus/core && npm test -w @ccstatus/core \
  && npm run typecheck -w ccstatus && npm test -w ccstatus && npm run build -w ccstatus \
  && npm run build:plugin-core && git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts \
  && claude plugin validate plugin >/dev/null && echo "ALL-CI-COMMANDS-GREEN"
```

Expected: `YAML-SHAPE-OK` and `ALL-CI-COMMANDS-GREEN`. (If `actionlint` is installed, also run it; otherwise the shape check + local command run is the gate.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add workspace test/typecheck/build + plugin validate + bundle-freshness workflow"
```

---

### Task 7: Decision & Flow records, CLAUDE.md

Record the packaging decisions and release flow, and update the convention notes, in the same change as the code (repo policy).

**Files:**

- Modify: `docs/DECISION.md` (add DEC-0010; update DEC-0003's gitignore note with a pointer)
- Modify: `docs/FLOW.md` (add FLOW-0004 — release/distribution)
- Modify: `CLAUDE.md` (package rename in commands; `.gitignore` note; link DEC-0010/FLOW-0004)

**Interfaces:**

- Consumes: the facts established in Tasks 2, 3, 5, 6.

- [ ] **Step 1: Add DEC-0010 to `docs/DECISION.md`** (append after DEC-0009; add the index-table row)

Index row:

```
| DEC-0010 | 2026-10-05 | Distribution: unscoped `ccstatus` bin, private bundled core, committed plugin bundle | Accepted | repo-wide |
```

Entry body (append at end of file):

```markdown
---

## DEC-0010 — Distribution: unscoped `ccstatus` bin, private bundled core, committed plugin bundle

- **Date:** 2026-10-05
- **Status:** Accepted
- **Scope:** repo-wide
- **Related:** DEC-0003, DEC-0004, [FLOW-0004](./FLOW.md#flow-0004--release--distribution)

### Context

Phase 4 makes ccstatus publicly installable: `npx ccstatus` for the TUI and a
Claude Code marketplace entry for the mod. Three choices had real alternatives.

### Decision

1. **The TUI is published under the unscoped npm name `ccstatus`** (not
   `@ccstatus/tui`), so `npx ccstatus` runs it with no scope or global install.
   `@ccstatus/core` stays `private` and is **bundled** into the TUI's `dist`
   (tsup `noExternal`); it is listed in `devDependencies`, never `dependencies`,
   so `npm install ccstatus` never tries to fetch the private package.
2. **The mod is distributed via a repo-root `.claude-plugin/marketplace.json`**
   pointing at `./plugin` — `claude plugin marketplace add sushant-kum/ccstatus`.
3. **The generated plugin core bundle (`plugin/hooks/core.js` + `core.d.ts`) is
   committed** (un-ignored), because a git/marketplace install reads the repo
   as-is and the mod imports `./core.js` at load. CI rebuilds it and fails on any
   diff, so the committed bundle can never drift from `@ccstatus/core`. This
   narrows DEC-0003's "gitignored, never committed" stance for these two files
   only; they remain generated and must never be hand-edited.

### Alternatives considered

- **Keep `@ccstatus/tui` scoped** — rejected: `npx ccstatus` wouldn't work
  without a global install; worse first-run UX than the spec's `npx ccstatus`.
- **Publish `@ccstatus/core` to npm and depend on it** — rejected: core as a
  public package is an explicit non-goal (spec); bundling keeps one artifact.
- **Keep the plugin bundle gitignored and build it in a release step** —
  rejected for v1: marketplace installs read the source tree directly, so a
  build-on-release path needs a separate release branch/tag or attached
  artifacts; committing the bundle + a CI freshness gate is simpler and correct.

### Consequences

- One published npm artifact (`ccstatus`) with no private-package dependency.
- `plugin/hooks/core.js` / `core.d.ts` are tracked but generated — regenerate
  with `npm run build:plugin-core`; CI enforces freshness.
- Actual `npm publish` and marketplace release are a later, credentialed step
  (see FLOW-0004); this phase only prepares them.
```

- [ ] **Step 2: Add FLOW-0004 to `docs/FLOW.md`** (append; add the index-table row)

Index row:

```
| FLOW-0004 | release & distribution | repo-wide | 2026-10-05 |
```

Entry body (append at end of file):

```markdown
---

## FLOW-0004 — Release & distribution

- **Scope:** repo-wide
- **Trigger:** cutting a public release of ccstatus (manual; not automated in v1).
- **Outcome:** `npx ccstatus` installs the TUI from npm; `claude plugin marketplace add sushant-kum/ccstatus` + install adds the mod.
- **Last verified:** 2026-10-05
- **Related:** DEC-0010, [FLOW-0003](#flow-0003--bundle-core-into-the-plugin)

### Steps

1. Ensure the core bundle is current: `npm run build:plugin-core` (CI also gates
   this via `git diff --exit-code`). Commit if it changed.
2. Verify green: `npm test -w @ccstatus/core`, `npm test -w ccstatus`,
   `npm run build -w ccstatus`, `claude plugin validate plugin`,
   `claude plugin test plugin`.
3. **TUI → npm:** bump `packages/tui/package.json` `version`, then
   `npm publish -w ccstatus` (the package is unscoped + `publishConfig.access:
public`; core is bundled, so no private dependency is fetched). Requires npm
   auth — **not performed in Phase 4.**
4. **Mod → marketplace:** bump the `version` in `plugin/.claude-plugin/plugin.json`
   and `.claude-plugin/marketplace.json`, tag/release the repo. Users then run
   `claude plugin marketplace add sushant-kum/ccstatus` and
   `claude plugin install ccstatus@ccstatus`. The committed `plugin/hooks/core.js`
   makes the installed mod loadable. **Not performed in Phase 4.**

### Branches & failure modes

- **Published `ccstatus` can't resolve `@ccstatus/core`** → core was left in
  `dependencies`; it must be bundled and in `devDependencies` only (DEC-0010).
- **Installed mod fails to load (`./core.js` missing)** → the bundle wasn't
  committed / went stale; rebuild and commit (CI drift check guards this).
- **`npm pack` ships `src/`** → `files` must be `["dist", "README.md"]`.
```

- [ ] **Step 3: Update `CLAUDE.md`**

- In the Commands section, change the TUI workspace name from `@ccstatus/tui` to `ccstatus` in the `npm test`/`typecheck`/`build` examples (the package is now unscoped; `@ccstatus/core` is unchanged).
- In the `.gitignore` conventions bullet, replace "covers `dist/`, `plugin/hooks/core.js`, `plugin/hooks/core.d.ts`…" with a note that those two plugin files are now **tracked but generated** (committed for distribution, kept fresh by CI; regenerate with `npm run build:plugin-core`, never hand-edit) — cross-link DEC-0010.
- Add DEC-0010 and FLOW-0004 to the Decision & Flow index table.

- [ ] **Step 4: Verify doc cross-links and index rows exist**

Run:

```bash
grep -q "DEC-0010" docs/DECISION.md && grep -q "FLOW-0004" docs/FLOW.md \
  && grep -q "DEC-0010" CLAUDE.md && grep -q "ccstatus" CLAUDE.md \
  && grep -q "npm test -w ccstatus\|test -w ccstatus" CLAUDE.md && echo "DOCS-OK"
```

Expected: `DOCS-OK`.

- [ ] **Step 5: Commit**

```bash
git add docs/DECISION.md docs/FLOW.md CLAUDE.md
git commit -m "docs: DEC-0010 + FLOW-0004 (distribution) and CLAUDE.md packaging notes"
```

---

## Final verification (run after all tasks)

- [ ] `npm ci` clean.
- [ ] `npm test -w @ccstatus/core` → 75 pass.
- [ ] `npm test -w ccstatus` → 52 pass.
- [ ] `npm run build -w ccstatus` → `dist/index.js` with shebang.
- [ ] `npm run build:plugin-core && git diff --exit-code plugin/hooks/core.js plugin/hooks/core.d.ts` → no diff.
- [ ] `claude plugin validate plugin` → passes, no author warning.
- [ ] `claude plugin test plugin` → 29 pass.
- [ ] `npm pack -w ccstatus --dry-run` → contains `dist/` + `README.md`, no `src/`.
- [ ] No `ccstatus` marketplace left configured (`claude plugin marketplace list | grep -c ccstatus` → 0).
- [ ] No `npm publish` / marketplace release was performed (Phase-4 scope).
