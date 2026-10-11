import { expect, test } from 'claude-code/testing';

import { parseGit } from './git-parse.js';
import { buildSnapshot } from './snapshot-build.js';

test('parseGit reads the tab line', () => {
  expect(parseGit('YES\tapp\tmain\twt\t1\t2\t3')).toEqual({
    repo: true,
    root: 'app',
    branch: 'main',
    worktree: 'wt',
    added: 1,
    modified: 2,
    deleted: 3,
    sha: '',
  });
});
test('parseGit handles no-repo', () => {
  expect(parseGit('NO')).toEqual({
    repo: false,
    root: '',
    branch: '',
    worktree: '',
    added: 0,
    modified: 0,
    deleted: 0,
    sha: '',
  });
});
test('buildSnapshot assembles totals and handles null usage', () => {
  const git = {
    repo: false,
    root: '',
    branch: '',
    worktree: '',
    added: 0,
    modified: 0,
    deleted: 0,
    sha: '',
  };
  const s = buildSnapshot({
    version: '2.1.0',
    model: 'Opus',
    effort: 'high',
    cwd: '/a/app',
    now: 1000,
    sessionId: '',
    outputStyle: null,
    terminalWidth: 0,
    git,
    usage: null,
  });
  expect(s.total).toBe(0);
  expect(s.cost).toBeNull();
  expect(s.fivePct).toBeNull();
  expect(Number.isNaN(s.ctxTokens)).toBe(false);
  expect(s.model).toBe('Opus');
});
test('buildSnapshot computes total from usage', () => {
  const git = {
    repo: true,
    root: 'app',
    branch: 'main',
    worktree: '',
    added: 0,
    modified: 0,
    deleted: 0,
    sha: '',
  };
  const usage = {
    ctxTokens: 42000,
    ctxPct: 21,
    cached: 1000,
    input: 2000,
    output: 500,
    startedAt: 0,
    fivePct: 30,
    fiveReset: null,
    weekPct: 10,
    weekReset: null,
    cost: null,
    ctxWindow: 0,
  };
  const s = buildSnapshot({
    version: '',
    model: '',
    effort: null,
    cwd: '',
    now: 0,
    sessionId: '',
    outputStyle: null,
    terminalWidth: 0,
    git,
    usage,
  });
  expect(s.total).toBe(3500);
  expect(s.repo).toBe(true);
  expect(s.gitBranch).toBe('main');
});
test('parseGit reads the sha column and tolerates its absence', () => {
  expect(parseGit('YES\troot\tmain\t\t1\t2\t0\tabc1234').sha).toBe('abc1234');
  expect(parseGit('YES\troot\tmain\t\t1\t2\t0').sha).toBe('');
  expect(parseGit('NO').sha).toBe('');
});
test('buildSnapshot carries sessionId, ctxWindow, gitSha, outputStyle, cost, terminalWidth', () => {
  const s = buildSnapshot({
    version: '1',
    model: 'm',
    effort: null,
    cwd: '/x',
    now: 0,
    sessionId: 'sess-123',
    outputStyle: 'concise',
    terminalWidth: 120,
    git: {
      repo: true,
      root: 'r',
      branch: 'b',
      worktree: '',
      added: 0,
      modified: 0,
      deleted: 0,
      sha: 'abc1234',
    },
    usage: {
      ctxTokens: 1,
      ctxPct: 2,
      cached: 0,
      input: 0,
      output: 0,
      startedAt: 0,
      fivePct: null,
      fiveReset: null,
      weekPct: null,
      weekReset: null,
      cost: 0.5,
      ctxWindow: 200000,
    },
  });
  expect(s.sessionId).toBe('sess-123');
  expect(s.gitSha).toBe('abc1234');
  expect(s.outputStyle).toBe('concise');
  expect(s.cost).toBe(0.5);
  expect(s.ctxWindow).toBe(200000);
  expect(s.terminalWidth).toBe(120);
});
