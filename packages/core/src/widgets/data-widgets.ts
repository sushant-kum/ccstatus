import type { Item } from '../config/types.js';
import { fmtDur, fmtNum, pct } from '../format.js';

import { register } from './registry.js';
import type { WidgetContext } from './types.js';

const labeled = (raw: boolean | undefined, label: string, value: string): string =>
  raw ? value : `${label}: ${value}`;

// The flex separator has no styling fields; every other item may set rawValue.
const rawOf = (item: Item): boolean | undefined => ('rawValue' in item ? item.rawValue : undefined);

register({ type: 'model', label: 'Model', format: ({ snapshot }) => snapshot.model || null });
register({
  type: 'version',
  label: 'Version',
  format: ({ snapshot, item }) =>
    snapshot.version ? (rawOf(item) ? snapshot.version : `v${snapshot.version}`) : null,
});
register({
  type: 'context-length',
  label: 'Ctx',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Ctx', fmtNum(snapshot.ctxTokens)),
});
register({
  type: 'context-percentage',
  label: 'Ctx Used',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Ctx Used', pct(snapshot.ctxPct)),
});
register({
  type: 'tokens-input',
  label: 'In',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'In', fmtNum(snapshot.input)),
});
register({
  type: 'tokens-output',
  label: 'Out',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Out', fmtNum(snapshot.output)),
});
register({
  type: 'tokens-cached',
  label: 'Cached',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Cached', fmtNum(snapshot.cached)),
});
register({
  type: 'tokens-total',
  label: 'Total',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Total', fmtNum(snapshot.total)),
});
register({
  type: 'session-clock',
  label: 'Session',
  format: ({ snapshot, item }) =>
    labeled(rawOf(item), 'Session', fmtDur(snapshot.now - snapshot.startedAt)),
});
register({
  type: 'cwd',
  label: 'cwd',
  format: ({ snapshot }: WidgetContext) => {
    if (!snapshot.cwd) {
      return null;
    }
    const parts = snapshot.cwd.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? snapshot.cwd;
  },
});
