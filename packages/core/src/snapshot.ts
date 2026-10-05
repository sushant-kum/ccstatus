export interface Snapshot {
  version: string;
  model: string;
  effort: string | null;
  cwd: string;
  repo: boolean;
  gitRoot: string;
  gitBranch: string;
  gitWorktree: string;
  added: number;
  modified: number;
  deleted: number;
  ctxTokens: number;
  ctxPct: number;
  cached: number;
  input: number;
  output: number;
  total: number;
  startedAt: number;
  cost: number | null;
  fivePct: number | null;
  fiveReset: string | null;
  weekPct: number | null;
  weekReset: string | null;
  blockReset: string | null;
  terminalWidth: number;
  now: number;
}
