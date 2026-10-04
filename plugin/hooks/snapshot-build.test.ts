import { test, expect } from 'claude-code/testing'
import { parseGit } from './git-parse.js'
import { buildSnapshot } from './snapshot-build.js'

test('parseGit reads the tab line', () => {
  expect(parseGit('YES\tapp\tmain\twt\t1\t2\t3')).toEqual({
    repo: true, root: 'app', branch: 'main', worktree: 'wt', added: 1, modified: 2, deleted: 3,
  })
})
test('parseGit handles no-repo', () => {
  expect(parseGit('NO')).toEqual({
    repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0,
  })
})
test('buildSnapshot assembles totals and handles null usage', () => {
  const git = { repo: false, root: '', branch: '', worktree: '', added: 0, modified: 0, deleted: 0 }
  const s = buildSnapshot({ version: '2.1.0', model: 'Opus', effort: 'high', cwd: '/a/app', now: 1000, git, usage: null })
  expect(s.total).toBe(0)
  expect(s.cost).toBeNull()
  expect(s.fivePct).toBeNull()
  expect(Number.isNaN(s.ctxTokens)).toBe(false)
  expect(s.model).toBe('Opus')
})
test('buildSnapshot computes total from usage', () => {
  const git = { repo: true, root: 'app', branch: 'main', worktree: '', added: 0, modified: 0, deleted: 0 }
  const usage = { ctxTokens: 42000, ctxPct: 21, cached: 1000, input: 2000, output: 500, startedAt: 0, fivePct: 30, fiveReset: null, weekPct: 10, weekReset: null }
  const s = buildSnapshot({ version: '', model: '', effort: null, cwd: '', now: 0, git, usage })
  expect(s.total).toBe(3500)
  expect(s.repo).toBe(true)
  expect(s.gitBranch).toBe('main')
})
