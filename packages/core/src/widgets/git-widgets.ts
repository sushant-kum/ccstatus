import { register } from './registry.js';

register({
  type: 'git-branch',
  label: 'Branch',
  format: ({ snapshot }) => (snapshot.repo ? `✎ ${snapshot.gitBranch || '?'}` : null),
});
register({
  type: 'git-root-dir',
  label: 'Git root',
  format: ({ snapshot }) => (snapshot.repo ? `⌂ ${snapshot.gitRoot || '?'}` : null),
});
register({
  type: 'git-changes',
  label: 'Changes',
  format: ({ snapshot }) =>
    snapshot.repo ? `(+${snapshot.added} ~${snapshot.modified} -${snapshot.deleted})` : null,
});
register({
  type: 'git-worktree',
  label: 'Worktree',
  format: ({ snapshot }) =>
    snapshot.repo && snapshot.gitWorktree ? `⎇ ${snapshot.gitWorktree}` : null,
});
register({
  type: 'git-insertions',
  label: 'Insertions',
  format: ({ snapshot }) => (snapshot.repo ? `+${snapshot.insertions}` : null),
});
register({
  type: 'git-deletions',
  label: 'Deletions',
  format: ({ snapshot }) => (snapshot.repo ? `-${snapshot.deletions}` : null),
});
register({
  type: 'git-sha',
  label: 'SHA',
  format: ({ snapshot }) => (snapshot.repo && snapshot.gitSha ? snapshot.gitSha : null),
});
