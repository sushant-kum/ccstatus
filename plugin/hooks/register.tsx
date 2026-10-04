import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import { render } from './core.js'
import type { Config, Snapshot } from './core.js'
import { configPath, parseConfig } from './config-io.js'
import { parseGit } from './git-parse.js'
import { buildSnapshot, type RawUsage } from './snapshot-build.js'
import { paintModel } from './paint.js'

const visible = atom({ plugin: 'ccstatus', key: 'visible' } as const, true)
const snapshot = atom({ plugin: 'ccstatus', key: 'snapshot' } as const, null)
const config = atom({ plugin: 'ccstatus', key: 'config' } as const, null)
const effort = atom({ plugin: 'ccstatus', key: 'effort' } as const, null)

const GIT = 'r=$(git rev-parse --show-toplevel 2>/dev/null)||{ printf NO;exit 0;};'
  + 'b=$(git rev-parse --abbrev-ref HEAD 2>/dev/null);'
  + 'w=$(git rev-parse --show-toplevel 2>/dev/null|xargs -I{} sh -c "git -C {} rev-parse --git-dir" 2>/dev/null);'
  + 's=$(git status --porcelain 2>/dev/null);'
  + 'a=$(printf "%s\\n" "$s"|grep -cE "^(A.|.A|\\?\\?)");'
  + 'm=$(printf "%s\\n" "$s"|grep -cE "^(M.|.M)");'
  + 'd=$(printf "%s\\n" "$s"|grep -cE "^(D.|.D)");'
  + 'printf "YES\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s" "$(basename "$r")" "$b" "" "$a" "$m" "$d"'

async function loadConfigFromDisk($: EngineInterface): Promise<Config> {
  try {
    const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined)
    const home = await $.env.get('HOME').catch(() => undefined)
    const path = configPath({ XDG_CONFIG_HOME: xdg, HOME: home })
    const text = await $.fs.read(path).catch(() => null)
    return parseConfig(typeof text === 'string' ? text : null).config
  } catch {
    return parseConfig(null).config
  }
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

let refreshing = false
async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const eff = await read($, effort).catch(() => null)
    const s = await measure($, eff) // compute first, then write (updater is sync)
    await update($, snapshot, () => s)
  } catch { /* keep last snapshot */ }
  finally { refreshing = false }
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
      const cfg = await loadConfigFromDisk($)
      await update($, config, () => cfg)
      await refresh($)
      $.clock.every(2000, () => void refresh($))
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

  on('command.run', { command: 'ccstatus' }, async $ => {
    const now = !(await read($, visible))
    await update($, visible, () => now)
    return { text: now ? 'ccstatus band shown.' : 'ccstatus band hidden.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
      if (e.props.hasSurvey || !(await read($, visible))) return next(e)
      const cfg = await read($, config)
      const snap = await read($, snapshot)
      if (!cfg || !snap) return next(e)
      const model = render(cfg, snap, { surface: 'band', width: e.props.bodyColumns || 0 })
      if (model.lines.length === 0) return next(e)
      return paintModel(model, $.ui.resolve(e) as any) as any
    } catch {
      return next(e)
    }
  })
}
