# ccstatus

A configurable status bar for Claude Code — the mod-system analog of
[ccstatusline](https://github.com/sirmalloc/ccstatusline). One JSON config
drives **four surfaces** — the above-prompt band, the native status line, an
openable pane, and threshold toasts — edited with an interactive TUI and
rendered live by a Claude Code mod. The TUI preview and the mod paint from the
same engine, so what you preview is what you get.

> **Status:** v1, pre-release (`0.1.0`). Not yet published to npm or a hosted
> marketplace — the published commands below work **once it ships**; until then
> use the [from-source setup](#development).

## Install

ccstatus has two halves that share one config file. _(Published install — these
work once ccstatus is on npm and the marketplace; to try it before then, see
[Development](#development).)_

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

On launch, `npx ccstatus` checks whether the mod is installed; if it isn't, it
shows a banner and offers to install it for you (press `i`). A successful install
takes effect after you restart Claude Code or run `/reload-plugins`.

## The four surfaces

- **Band** — a status row above the prompt.
- **Status line** — the native Claude Code status line.
- **Pane** — an openable panel with the full bar.
- **Toasts** — threshold alerts (e.g. context % over a limit).

All four are driven by the same config and the same 21 widget types (model,
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
