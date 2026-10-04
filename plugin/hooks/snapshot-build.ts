import type { Snapshot } from './core.js'
import type { GitFields } from './git-parse.js'

export type RawUsage = {
  ctxTokens: number; ctxPct: number
  cached: number; input: number; output: number; startedAt: number
  fivePct: number | null; fiveReset: string | null
  weekPct: number | null; weekReset: string | null
} | null

export function buildSnapshot(raw: {
  version: string; model: string; effort: string | null; cwd: string; now: number
  git: GitFields; usage: RawUsage
}): Snapshot {
  const u = raw.usage
  const cached = u?.cached ?? 0
  const input = u?.input ?? 0
  const output = u?.output ?? 0
  return {
    version: raw.version,
    model: raw.model,
    effort: raw.effort,
    cwd: raw.cwd,
    repo: raw.git.repo,
    gitRoot: raw.git.root,
    gitBranch: raw.git.branch,
    gitWorktree: raw.git.worktree,
    added: raw.git.added,
    modified: raw.git.modified,
    deleted: raw.git.deleted,
    ctxTokens: u?.ctxTokens ?? 0,
    ctxPct: u?.ctxPct ?? 0,
    cached, input, output,
    total: cached + input + output,
    startedAt: u?.startedAt ?? 0,
    cost: null,
    fivePct: u?.fivePct ?? null,
    fiveReset: u?.fiveReset ?? null,
    weekPct: u?.weekPct ?? null,
    weekReset: u?.weekReset ?? null,
    blockReset: null,
    terminalWidth: 0,
    now: raw.now,
  }
}
