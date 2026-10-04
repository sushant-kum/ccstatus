export type GitFields = {
  repo: boolean; root: string; branch: string; worktree: string
  added: number; modified: number; deleted: number
}

const none: GitFields = { repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0 }

export function parseGit(stdout: string): GitFields {
  const t = (stdout || '').trim().split('\t')
  if (t[0] !== 'YES') return { ...none }
  return {
    repo: true,
    root: t[1] ?? '',
    branch: t[2] ?? '',
    worktree: t[3] ?? '',
    added: Number(t[4]) || 0,
    modified: Number(t[5]) || 0,
    deleted: Number(t[6]) || 0,
  }
}
