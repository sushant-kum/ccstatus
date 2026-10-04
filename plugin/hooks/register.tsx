import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import { render, toAnsi } from './core.js'
import type { Config, Snapshot } from './core.js'
import { configPath, parseConfig, shouldReload, snapshotPath } from './config-io.js'
import { dueToasts, evalWhen } from './toasts.js'
import { parseGit } from './git-parse.js'
import { buildSnapshot, type RawUsage } from './snapshot-build.js'
import { paintModel } from './paint.js'

const visible = atom({ plugin: 'ccstatus', key: 'visible' } as const, true)
const snapshot = atom({ plugin: 'ccstatus', key: 'snapshot' } as const, null)
const config = atom({ plugin: 'ccstatus', key: 'config' } as const, null)
const paneOpen = atom({ plugin: 'ccstatus', key: 'paneOpen' } as const, false)
const toastFired = atom({ plugin: 'ccstatus', key: 'toastFired' } as const, {} as Record<string, boolean>)
const configMtime = atom({ plugin: 'ccstatus', key: 'configMtime' } as const, null as number | null)
const effort = atom({ plugin: 'ccstatus', key: 'effort' } as const, null)

const GIT = 'r=$(git rev-parse --show-toplevel 2>/dev/null)||{ printf NO;exit 0;};'
  + 'b=$(git rev-parse --abbrev-ref HEAD 2>/dev/null);'
  + 'gd=$(git rev-parse --git-dir 2>/dev/null); case "$gd" in */worktrees/*) w=$(basename "$gd");; *) w="";; esac;'
  + 's=$(git status --porcelain 2>/dev/null);'
  + 'a=$(printf "%s\\n" "$s"|grep -cE "^(A.|.A|\\?\\?)");'
  + 'm=$(printf "%s\\n" "$s"|grep -cE "^(M.|.M)");'
  + 'd=$(printf "%s\\n" "$s"|grep -cE "^(D.|.D)");'
  + 'printf "YES\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s" "$(basename "$r")" "$b" "$w" "$a" "$m" "$d"'

async function resolveConfigPath($: EngineInterface): Promise<string> {
  const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined)
  const home = await $.env.get('HOME').catch(() => undefined)
  return configPath({ XDG_CONFIG_HOME: xdg, HOME: home })
}

async function loadConfigFromDisk($: EngineInterface): Promise<Config> {
  try {
    const text = await $.fs.read(await resolveConfigPath($)).catch(() => null)
    return parseConfig(typeof text === 'string' ? text : null).config
  } catch {
    return parseConfig(null).config
  }
}

// Re-read the config when its mtime changed (or always when forced).
async function reloadConfig($: EngineInterface, force: boolean): Promise<boolean> {
  try {
    const path = await resolveConfigPath($)
    const stat = await $.fs.stat(path).catch(() => null)
    const prev = await read($, configMtime)
    if (!force && (!stat || !shouldReload(prev, stat))) return false
    const cfg = await loadConfigFromDisk($)
    await update($, config, () => cfg)
    await update($, configMtime, () => stat ? stat.mtimeMs : null)
    return true
  } catch { return false }
}

async function setTheme($: EngineInterface, name: string): Promise<string> {
  const cfg = await read($, config) as Config | null
  if (!cfg) return 'ccstatus: config not loaded yet.'
  if (!name || !cfg.themes[name]) {
    return `ccstatus: unknown theme "${name}". Available: ${Object.keys(cfg.themes).join(', ')}`
  }
  const next: Config = { ...cfg, theme: name }
  await update($, config, () => next)
  try {
    await $.fs.write(await resolveConfigPath($), JSON.stringify(next, null, 2) + '\n')
  } catch { return `ccstatus: theme set to ${name} (could not save the config file).` }
  return `ccstatus: theme set to ${name}.`
}

async function measure($: EngineInterface, eff: string | null): Promise<Snapshot> {
  const [version, model, cwd, usageRaw] = await Promise.all([
    $.session.version().then(v => v.version).catch(() => ''),
    $.session.model().catch(() => ''),
    $.session.cwd().catch(() => ''),
    $.session.usage({ breakdown: 'summary' }).catch(() => null),
  ])
  let git = parseGit('NO')
  if (cwd) {
    try {
      const { stdout } = await $.process.run(['sh', '-c', GIT], { cwd, timeoutMs: 5000 })
      git = parseGit(stdout || '')
    } catch { /* keep no-repo */ }
  }
  const b = usageRaw?.context?.breakdown ?? null
  const u = b?.apiUsage ?? null
  const rl = usageRaw?.rateLimits ?? []
  const five = rl.find(r => r.kind === 'five_hour') ?? null
  const week = rl.find(r => r.kind === 'seven_day') ?? null
  const usage: RawUsage = {
    ctxTokens: b?.totalTokens ?? usageRaw?.context?.tokens ?? 0,
    ctxPct: b?.percentage ?? usageRaw?.context?.percent ?? 0,
    cached: u ? u.cache_read_input_tokens + u.cache_creation_input_tokens : 0,
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    startedAt: usageRaw?.startedAt ?? 0,
    fivePct: five?.percentUsed ?? null,
    fiveReset: five?.resetsAt ?? null,
    weekPct: week?.percentUsed ?? null,
    weekReset: week?.resetsAt ?? null,
  }
  return buildSnapshot({ version, model, effort: eff, cwd, now: await $.clock.now(), git, usage })
}

async function fireToasts($: EngineInterface, cfg: Config, snap: Snapshot): Promise<void> {
  try {
    if (!cfg.surfaces.toasts.enabled) return
    const rules = cfg.surfaces.toasts.rules
    const fired = (await read($, toastFired)) ?? {}
    const next: Record<string, boolean> = { ...fired }
    for (const t of dueToasts(rules, snap, fired)) {
      try { await $.ui.toast(t.text) } catch { /* guarded */ }
      next[t.key] = true
    }
    for (const r of rules) if (!evalWhen(r.when, snap)) delete next[r.when]
    if (JSON.stringify(next) !== JSON.stringify(fired)) await update($, toastFired, () => next)
  } catch { /* never throw from a refresh */ }
}

async function applySurfaces($: EngineInterface, snap: Snapshot): Promise<void> {
  try {
    const cfg = await read($, config) as Config | null
    if (!cfg) return
    await fireToasts($, cfg, snap)
    if (cfg.surfaces.statusline.enabled) {
      await $.ui.status(toAnsi(render(cfg, snap, { surface: 'statusline', width: snap.terminalWidth || 200 })))
    } else {
      await $.ui.status(undefined)
    }
  } catch { /* never throw from a refresh */ }
}

let refreshing = false
async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const eff = await read($, effort).catch(() => null)
    const s = await measure($, eff) // compute first, then write (updater is sync)
    await update($, snapshot, () => s)
    try {
      const env = {
        HOME: await $.env.get('HOME').catch(() => undefined),
        XDG_CONFIG_HOME: await $.env.get('XDG_CONFIG_HOME').catch(() => undefined),
      }
      await $.fs.write(snapshotPath(env), JSON.stringify(s)).catch(() => {})
    } catch { /* ignore snapshot persistence errors */ }
    await applySurfaces($, s)
  } catch { /* keep last snapshot */ }
  finally { refreshing = false }
}

async function togglePane($: EngineInterface): Promise<string> {
  if (await read($, paneOpen)) {
    await $.ui.close({ id: 'ccstatus' })
    await update($, paneOpen, () => false)
    return 'ccstatus pane closed.'
  }
  await $.ui.open({ id: 'ccstatus', title: 'ccstatus' })
  await update($, paneOpen, () => true)
  return 'ccstatus pane opened.'
}

function captureEffort($: EngineInterface, e: unknown): Promise<void> {
  const active = (e as { effort?: { active?: unknown } })?.effort?.active
  if (typeof active === 'string' && active) {
    return update($, effort, () => active).then(() => undefined, () => undefined)
  }
  return Promise.resolve()
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'ccstatus', description: 'Toggle the ccstatus band above the prompt' })
      await reloadConfig($, true)
      await refresh($)
      $.clock.every(2000, () => void reloadConfig($, false).then(() => refresh($)))
    } catch { /* never block session start */ }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await captureEffort($, e)
    await refresh($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await captureEffort($, e)
    return next(e)
  })

  on('command.run', { command: 'ccstatus' }, async ($, e) => {
    try {
      const args = String((e as { args?: unknown })?.args ?? '').trim()
      const [sub = '', ...rest] = args.split(/\s+/)
      if (sub === 'pane') return { text: await togglePane($) }
      if (sub === 'reload') {
        await reloadConfig($, true)
        await refresh($)
        return { text: 'ccstatus config reloaded.' }
      }
      if (sub === 'theme') return { text: await setTheme($, rest[0] ?? '') }
      if (sub === 'edit') return { text: 'Edit your layout with the ccstatus editor: run `npx ccstatus` in a terminal. Changes are picked up automatically.' }
      const now = !(await read($, visible))
      await update($, visible, () => now)
      return { text: now ? 'ccstatus band shown.' : 'ccstatus band hidden.' }
    } catch {
      return { text: 'ccstatus: command failed.' }
    }
  })

  on('ui.close', async ($, e, next) => {
    try {
      if ((e as { id?: string }).id === 'ccstatus') await update($, paneOpen, () => false)
    } catch { /* ignore */ }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'ccstatus' }, async ($, e, next) => {
    try {
      const cfg = await read($, config)
      const snap = await read($, snapshot)
      if (!cfg || !snap) return next(e)
      const model = render(cfg, snap, { surface: 'pane', width: e.props.bodyColumns || 80 })
      if (model.lines.length === 0) return next(e)
      return paintModel(model, $.ui.resolve(e) as any) as any
    } catch {
      return next(e)
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
      if (e.props.hasSurvey || !(await read($, visible))) return next(e)
      const cfg = await read($, config)
      const snap = await read($, snapshot)
      if (!cfg || !snap) return next(e)
      const width = e.props.bodyColumns
      if (!width) return next(e) // not measured yet: let the engine draw
      const model = render(cfg, snap, { surface: 'band', width })
      if (model.lines.length === 0) return next(e)
      return paintModel(model, $.ui.resolve(e) as any) as any
    } catch {
      return next(e)
    }
  })
}
