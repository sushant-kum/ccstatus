import type { Snapshot } from './core.js';
import type { GitFields } from './git-parse.js';

export type RawUsage = {
  ctxTokens: number;
  ctxPct: number;
  cached: number;
  input: number;
  output: number;
  startedAt: number;
  fivePct: number | null;
  fiveReset: string | null;
  weekPct: number | null;
  weekReset: string | null;
} | null;

const emptyUsage: NonNullable<RawUsage> = {
  ctxTokens: 0,
  ctxPct: 0,
  cached: 0,
  input: 0,
  output: 0,
  startedAt: 0,
  fivePct: null,
  fiveReset: null,
  weekPct: null,
  weekReset: null,
};

/**
 * Assemble a full `Snapshot` from the raw session, git, and usage fields.
 * @param raw         - The gathered raw inputs.
 * @param raw.version - The Claude Code version string.
 * @param raw.model   - The active model identifier.
 * @param raw.effort  - The active reasoning effort, or `null` when unknown.
 * @param raw.cwd     - The current working directory.
 * @param raw.now     - The current clock time in milliseconds.
 * @param raw.git     - The parsed git fields for the working directory.
 * @param raw.usage   - The raw usage figures, or `null` when unavailable.
 * @returns           The complete snapshot with usage defaults filled in.
 */
export function buildSnapshot(raw: {
  version: string;
  model: string;
  effort: string | null;
  cwd: string;
  now: number;
  git: GitFields;
  usage: RawUsage;
}): Snapshot {
  const u = raw.usage ?? emptyUsage;
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
    ctxTokens: u.ctxTokens,
    ctxPct: u.ctxPct,
    cached: u.cached,
    input: u.input,
    output: u.output,
    total: u.cached + u.input + u.output,
    startedAt: u.startedAt,
    cost: null,
    fivePct: u.fivePct,
    fiveReset: u.fiveReset,
    weekPct: u.weekPct,
    weekReset: u.weekReset,
    blockReset: null,
    terminalWidth: 0,
    now: raw.now,
  };
}
