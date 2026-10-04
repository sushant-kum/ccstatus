// The types contract must be self-contained (no imports), so the shapes the
// plugin keeps in state are restated here; they mirror hooks/core.d.ts.
export type CcstatusPlaceholder = never

export type CcstatusSnapshot = {
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
};

declare module 'claude-code' {
  interface PluginState {
    ccstatus: {
      visible: boolean
      snapshot: CcstatusSnapshot | null
      config: { [key: string]: unknown } | null
      effort: string | null
      paneOpen: boolean
      configMtime: number | null
      toastFired: Record<string, boolean>
    }
  }
}
