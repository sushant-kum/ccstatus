# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.2.0](https://github.com/sushant-kum/ccstatus/compare/0.1.2...0.2.0) (2026-10-13)

### ⚠ BREAKING CHANGES

- per-item fg/bg are removed and legacy per-widget themes are
  dropped on load; colors now come from a positional palette (see DEC-0020).

  - feat(core): add positional palette-assignment pass

  - feat(core): apply positional palette colors in render

  - build: regenerate plugin core bundle for positional palette theming

  - feat(tui): palette-only item editor and positional palette theme editor

  - test(tui): guard fg immutability in theme slot picker test

  - docs: record positional palette theming (DEC-0020, DEC-0021)

  FLOW.md unchanged: no FLOW entry describes per-widget/item color resolution.

  - docs: reword "regen" to satisfy cspell

  - fix(core,tui): align palette merge continuation with compose and harden theme handling

  Merge continuation now requires a non-flex predecessor, theme lookups use
  Object.hasOwn, and the themes screen gains slot-editor key tests.

  - build: regenerate plugin core bundle

  - fix(core): preserve palette slot positions, guard prototype keys, correct docs

  PR review follow-ups:
  - cleanThemes replaces a non-object slot with an empty slot instead of dropping
    it, so an invalid slot no longer re-colors every later position; distinguishes
    a legacy per-widget object from a non-object theme value in the drop warning.
  - render guards the active-theme lookup with Object.hasOwn so a prototype-key
    name (e.g. "toString") on a hand-built Config cannot resolve to an inherited
    member; cleanThemes builds a prototype-free container for the same reason.
  - cells.ts JSDoc no longer claims it resolves colors (colors are assigned
    downstream by assignPaletteColors); palette.ts clarifies the merge-continuation
    rule; validate.ts [@param](https://github.com/param) wording matches the single-warning behavior.
  - Tests: explicit fg wins over auto-contrast, per-line counter reset, slot
    replacement preserves positions, builtins retained/not-folded, warning wording.
  * test(tui): cover fg picker (none) clearing a slot for auto-contrast

  The fg list already offered '(none)' (NAMED_COLORS begins with it); add a test
  pinning that selecting it clears the slot fg while keeping bg, and note the
  asymmetry with the bg list in a comment.

  - build: regenerate plugin core bundle

### Features

- positional palette theming (colors by position, not widget type) ([#8](https://github.com/sushant-kum/ccstatus/issues/8)) ([9a52899](https://github.com/sushant-kum/ccstatus/commit/9a52899fc1724b146c9b98491fb16730b596624d))

## [0.1.2](https://github.com/sushant-kum/ccstatus/compare/0.1.1...0.1.2) (2026-10-12)

### Features

- linked surface layouts (band/statusline/pane) ([#5](https://github.com/sushant-kum/ccstatus/issues/5)) ([7efca89](https://github.com/sushant-kum/ccstatus/commit/7efca89c31ab99f23d900b90b3cfc5e479815649)), references [5/#6](https://github.com/sushant-kum/ccstatus/issues/6)

## 0.1.1 (2026-10-12)

### Features

- ccstatusline widget parity (Tier A+B) — 15 widgets, snapshot fields, importer rewrite ([#4](https://github.com/sushant-kum/ccstatus/issues/4)) ([b7a353b](https://github.com/sushant-kum/ccstatus/commit/b7a353bde504a5be253d92abdd444765c57c361f))
- multicolour status line via native statusLine command + band/pane colour fix ([#3](https://github.com/sushant-kum/ccstatus/issues/3)) ([26a827d](https://github.com/sushant-kum/ccstatus/commit/26a827d4b75c9bced296f11bafb381194d095764))
