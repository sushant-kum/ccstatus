import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import { configPath, parseConfig, shouldReload, snapshotPath } from './config-io.js';
import { render } from './core.js';
import type { Config, Snapshot } from './core.js';
import { parseGit } from './git-parse.js';
import { paintModel } from './paint.js';
import { buildSnapshot, type RawUsage } from './snapshot-build.js';
import { dueToasts, evalWhen } from './toasts.js';

const visible = atom({ plugin: 'ccstatus', key: 'visible' } as const, true);
const snapshot = atom({ plugin: 'ccstatus', key: 'snapshot' } as const, null);
const config = atom({ plugin: 'ccstatus', key: 'config' } as const, null);
const paneOpen = atom({ plugin: 'ccstatus', key: 'paneOpen' } as const, false);
const toastFired = atom(
  { plugin: 'ccstatus', key: 'toastFired' } as const,
  {} as Record<string, boolean>
);
const configMtime = atom(
  { plugin: 'ccstatus', key: 'configMtime' } as const,
  null as number | null
);
const effort = atom({ plugin: 'ccstatus', key: 'effort' } as const, null);

const GIT =
  'r=$(git rev-parse --show-toplevel 2>/dev/null)||{ printf NO;exit 0;};' +
  'b=$(git rev-parse --abbrev-ref HEAD 2>/dev/null);' +
  'gd=$(git rev-parse --git-dir 2>/dev/null); case "$gd" in */worktrees/*) w=$(basename "$gd");; *) w="";; esac;' +
  's=$(git status --porcelain 2>/dev/null);' +
  'a=$(printf "%s\\n" "$s"|grep -cE "^(A.|.A|\\?\\?)");' +
  'm=$(printf "%s\\n" "$s"|grep -cE "^(M.|.M)");' +
  'd=$(printf "%s\\n" "$s"|grep -cE "^(D.|.D)");' +
  'printf "YES\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s" "$(basename "$r")" "$b" "$w" "$a" "$m" "$d"';

/**
 * Resolve the config file path using the engine's environment.
 * @param $ - The engine interface.
 * @returns The absolute path to the config file.
 */
async function resolveConfigPath($: EngineInterface): Promise<string> {
  const xdg = await $.env.get('XDG_CONFIG_HOME').catch(() => undefined);
  const home = await $.env.get('HOME').catch(() => undefined);
  return configPath({ XDG_CONFIG_HOME: xdg, HOME: home });
}

/**
 * Read and parse the config from disk, falling back to defaults on any error.
 * @param $ - The engine interface.
 * @returns The loaded config and any warnings raised while validating it.
 */
async function loadConfigFromDisk(
  $: EngineInterface
): Promise<{ config: Config; warnings: string[] }> {
  try {
    const text = await $.fs.read(await resolveConfigPath($)).catch(() => null);
    return parseConfig(typeof text === 'string' ? text : null);
  } catch {
    return parseConfig(null);
  }
}

/**
 * Re-read the config when its mtime changed, or always when forced.
 * @param $     - The engine interface.
 * @param force - When `true`, reload regardless of the file's mtime.
 * @returns     `true` when the config was reloaded, `false` otherwise.
 */
async function reloadConfig($: EngineInterface, force: boolean): Promise<boolean> {
  try {
    const path = await resolveConfigPath($);
    const stat = await $.fs.stat(path).catch(() => null);
    const prev = await read($, configMtime);
    if (!force && (!stat || !shouldReload(prev, stat))) {
      return false;
    }
    const { config: cfg, warnings } = await loadConfigFromDisk($);
    await update($, config, () => cfg);
    await update($, configMtime, () => (stat ? stat.mtimeMs : null));
    // Make a rejected/degraded config observable instead of silently showing defaults.
    if (warnings.length) {
      try {
        await $.ui.toast(
          `ccstatus: config had ${warnings.length} problem(s); using defaults where needed — run \`npx @sushant-kum/ccstatus\` to fix`
        );
      } catch {
        /* guarded: never throw from a reload */
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Switch the active theme and persist it to the config file atomically.
 * @param $    - The engine interface.
 * @param name - The theme name to switch to.
 * @returns    A status message describing the outcome.
 */
async function setTheme($: EngineInterface, name: string): Promise<string> {
  const cfg = (await read($, config)) as Config | null;
  if (!cfg) {
    return 'ccstatus: config not loaded yet.';
  }
  if (!name || !cfg.themes[name]) {
    return `ccstatus: unknown theme "${name}". Available: ${Object.keys(cfg.themes).join(', ')}`;
  }
  const next: Config = { ...cfg, theme: name };
  await update($, config, () => next);
  const path = await resolveConfigPath($);
  const tmp = path + '.tmp';
  try {
    // Atomic write, matching the TUI's saveConfigFile discipline. The sandbox fs
    // has no rename, but $.process.run does (the same shell-out the git snapshot
    // uses), and rename within one directory is atomic — so a reader never sees a
    // half-written config.json, and a .bak keeps the prior file recoverable.
    const existing = await $.fs.read(path).catch(() => null);
    if (typeof existing === 'string') {
      await $.fs.write(path + '.bak', existing).catch(() => {
        /* no-op: a missing backup must not abort the write */
      });
    }
    await $.fs.write(tmp, JSON.stringify(next, null, 2) + '\n');
    const { exitCode } = await $.process.run(['mv', '-f', tmp, path], { timeoutMs: 5000 });
    if (exitCode !== 0) {
      return `ccstatus: theme set to ${name} (could not save the config file).`;
    }
  } catch {
    return `ccstatus: theme set to ${name} (could not save the config file).`;
  }
  return `ccstatus: theme set to ${name}.`;
}

type UsageRaw = Awaited<ReturnType<EngineInterface['session']['usage']>>;

/**
 * Run the git probe in a directory, returning no-repo fields on any failure.
 * @param $   - The engine interface.
 * @param cwd - The directory to probe, or an empty string to skip the probe.
 * @returns   The parsed git fields for the directory.
 */
async function probeGit($: EngineInterface, cwd: string): Promise<ReturnType<typeof parseGit>> {
  if (!cwd) {
    return parseGit('NO');
  }
  try {
    const { stdout } = await $.process.run(['sh', '-c', GIT], { cwd, timeoutMs: 5000 });
    return parseGit(stdout || '');
  } catch {
    return parseGit('NO');
  }
}

type UsageContext = NonNullable<UsageRaw>['context'];
type UsageRateLimits = NonNullable<UsageRaw>['rateLimits'];

/**
 * Reduce the context portion of the raw usage report into snapshot fields.
 * @param context - The raw context report, or `null`/`undefined` when absent.
 * @returns       The normalized context usage figures.
 */
function extractContextUsage(
  context: UsageContext | null
): Pick<RawUsage & object, 'ctxTokens' | 'ctxPct' | 'cached' | 'input' | 'output'> {
  const b = context?.breakdown ?? null;
  const u = b?.apiUsage ?? null;
  return {
    ctxTokens: b?.totalTokens ?? context?.tokens ?? 0,
    ctxPct: b?.percentage ?? context?.percent ?? 0,
    cached: u ? u.cache_read_input_tokens + u.cache_creation_input_tokens : 0,
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
  };
}

/**
 * Reduce the rate-limit portion of the raw usage report into snapshot fields.
 * @param rl - The raw rate-limit entries.
 * @returns  The normalized five-hour and weekly usage figures.
 */
function extractRateLimitUsage(
  rl: UsageRateLimits
): Pick<RawUsage & object, 'fivePct' | 'fiveReset' | 'weekPct' | 'weekReset'> {
  const five = rl.find((r) => r.kind === 'five_hour') ?? null;
  const week = rl.find((r) => r.kind === 'seven_day') ?? null;
  return {
    fivePct: five?.percentUsed ?? null,
    fiveReset: five?.resetsAt ?? null,
    weekPct: week?.percentUsed ?? null,
    weekReset: week?.resetsAt ?? null,
  };
}

/**
 * Reduce the engine's raw usage report into the fields the snapshot needs.
 * @param usageRaw - The raw usage report, or `null` when it could not be read.
 * @returns        The normalized usage figures.
 */
function extractUsage(usageRaw: UsageRaw | null): RawUsage {
  const context = usageRaw?.context ?? null;
  const rl = usageRaw?.rateLimits ?? [];
  return {
    ...extractContextUsage(context),
    ...extractRateLimitUsage(rl),
    startedAt: usageRaw?.startedAt ?? 0,
  };
}

/**
 * Gather a live snapshot from the session, git, and usage sources.
 * @param $   - The engine interface.
 * @param eff - The active reasoning effort, or `null` when unknown.
 * @returns   The assembled snapshot.
 */
async function measure($: EngineInterface, eff: string | null): Promise<Snapshot> {
  const [version, model, cwd, usageRaw] = await Promise.all([
    $.session
      .version()
      .then((v) => v.version)
      .catch(() => ''),
    $.session.model().catch(() => ''),
    $.session.cwd().catch(() => ''),
    $.session.usage({ breakdown: 'summary' }).catch(() => null),
  ]);
  const git = await probeGit($, cwd);
  const usage = extractUsage(usageRaw);
  return buildSnapshot({ version, model, effort: eff, cwd, now: await $.clock.now(), git, usage });
}

/**
 * Fire any due toasts and update the per-rule fired state, never throwing.
 * @param $    - The engine interface.
 * @param cfg  - The active config.
 * @param snap - The current snapshot the toast rules are evaluated against.
 */
async function fireToasts($: EngineInterface, cfg: Config, snap: Snapshot): Promise<void> {
  try {
    if (!cfg.surfaces.toasts.enabled) {
      return;
    }
    const rules = cfg.surfaces.toasts.rules;
    const fired = (await read($, toastFired)) ?? {};
    const next: Record<string, boolean> = { ...fired };
    for (const t of dueToasts(rules, snap, fired)) {
      try {
        await $.ui.toast(t.text);
      } catch {
        /* guarded */
      }
      next[t.key] = true;
    }
    for (const r of rules) {
      if (!evalWhen(r.when, snap)) {
        delete next[r.when];
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(fired)) {
      await update($, toastFired, () => next);
    }
  } catch {
    /* never throw from a refresh */
  }
}

/**
 * Fire any due toasts for a snapshot, never throwing. The native status line is
 * rendered by the `ccstatus statusline` settings command, not the mod.
 * @param $    - The engine interface.
 * @param snap - The current snapshot to evaluate toasts against.
 */
async function applySurfaces($: EngineInterface, snap: Snapshot): Promise<void> {
  try {
    const cfg = (await read($, config)) as Config | null;
    if (!cfg) {
      return;
    }
    await fireToasts($, cfg, snap);
  } catch {
    /* never throw from a refresh */
  }
}

let refreshing = false;
/**
 * Measure a fresh snapshot, persist it, and repaint all surfaces.
 * @param $ - The engine interface.
 */
async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) {
    return;
  }
  refreshing = true;
  try {
    const eff = await read($, effort).catch(() => null);
    const s = await measure($, eff); // compute first, then write (updater is sync)
    await update($, snapshot, () => s);
    try {
      const env = {
        HOME: await $.env.get('HOME').catch(() => undefined),
        XDG_CONFIG_HOME: await $.env.get('XDG_CONFIG_HOME').catch(() => undefined),
      };
      await $.fs.write(snapshotPath(env), JSON.stringify(s)).catch(() => {
        /* no-op: snapshot persistence is best-effort */
      });
    } catch {
      /* ignore snapshot persistence errors */
    }
    await applySurfaces($, s);
  } catch {
    /* keep last snapshot */
  } finally {
    refreshing = false;
  }
}

/**
 * Toggle the ccstatus pane open or closed.
 * @param $ - The engine interface.
 * @returns A status message describing the new pane state.
 */
async function togglePane($: EngineInterface): Promise<string> {
  if (await read($, paneOpen)) {
    await $.ui.close({ id: 'ccstatus' });
    await update($, paneOpen, () => false);
    return 'ccstatus pane closed.';
  }
  await $.ui.open({ id: 'ccstatus', title: 'ccstatus' });
  await update($, paneOpen, () => true);
  return 'ccstatus pane opened.';
}

/**
 * Capture the active reasoning effort from an engine event into plugin state.
 * @param $ - The engine interface.
 * @param e - The engine event, inspected for an `effort.active` field.
 * @returns A promise that resolves once the effort has been recorded.
 */
function captureEffort($: EngineInterface, e: unknown): Promise<void> {
  const active = (e as { effort?: { active?: unknown } })?.effort?.active;
  if (typeof active === 'string' && active) {
    return update($, effort, () => active).then(
      () => undefined,
      () => undefined
    );
  }
  return Promise.resolve();
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'ccstatus',
        description: 'Toggle the ccstatus band above the prompt',
      });
      await reloadConfig($, true);
      await refresh($);
      $.clock.every(2000, () => void reloadConfig($, false).then(() => refresh($)));
    } catch {
      /* never block session start */
    }
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    await captureEffort($, e);
    await refresh($);
    return next(e);
  });

  on('tool.call', async ($, e, next) => {
    await captureEffort($, e);
    return next(e);
  });

  on('command.run', { command: 'ccstatus' }, async ($, e) => {
    try {
      const args = String((e as { args?: unknown })?.args ?? '').trim();
      const [sub = '', ...rest] = args.split(/\s+/);
      if (sub === 'pane') {
        return { text: await togglePane($) };
      }
      if (sub === 'reload') {
        await reloadConfig($, true);
        await refresh($);
        return { text: 'ccstatus config reloaded.' };
      }
      if (sub === 'theme') {
        return { text: await setTheme($, rest[0] ?? '') };
      }
      if (sub === 'edit') {
        return {
          text:
            'Edit your layout with the ccstatus editor: run `npx @sushant-kum/ccstatus` in a terminal. ' +
            'Changes are picked up automatically.',
        };
      }
      const now = !(await read($, visible));
      await update($, visible, () => now);
      return { text: now ? 'ccstatus band shown.' : 'ccstatus band hidden.' };
    } catch {
      return { text: 'ccstatus: command failed.' };
    }
  });

  on('ui.close', async ($, e, next) => {
    try {
      if ((e as { id?: string }).id === 'ccstatus') {
        await update($, paneOpen, () => false);
      }
    } catch {
      /* ignore */
    }
    return next(e);
  });

  on('ui.render', { component: 'Pane', requestId: 'ccstatus' }, async ($, e, next) => {
    try {
      const cfg = await read($, config);
      const snap = await read($, snapshot);
      if (!cfg || !snap) {
        return next(e);
      }
      const model = render(cfg, snap, { surface: 'pane', width: e.props.bodyColumns || 80 });
      if (model.lines.length === 0) {
        return next(e);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- engine boundary: $.ui.resolve + handler element types
      return paintModel(model, $.ui.resolve(e) as any) as any;
    } catch {
      return next(e);
    }
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
      if (e.props.hasSurvey || !(await read($, visible))) {
        return next(e);
      }
      const cfg = await read($, config);
      const snap = await read($, snapshot);
      if (!cfg || !snap) {
        return next(e);
      }
      const width = e.props.bodyColumns;
      if (!width) {
        return next(e);
      } // not measured yet: let the engine draw
      const model = render(cfg, snap, { surface: 'band', width });
      if (model.lines.length === 0) {
        return next(e);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- engine boundary: $.ui.resolve + handler element types
      return paintModel(model, $.ui.resolve(e) as any) as any;
    } catch {
      return next(e);
    }
  });
};
