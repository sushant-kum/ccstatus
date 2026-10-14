import type { Item } from '../config/types.js';
import { bar, fmtDur, fmtNum, pct } from '../format.js';

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

register({
  type: 'context-bar',
  label: 'Ctx Bar',
  format: ({ snapshot }) => bar(snapshot.ctxPct),
});
register({
  type: 'context-remaining',
  label: 'Ctx Left',
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Ctx Left', pct(100 - snapshot.ctxPct)),
});
register({
  type: 'thinking-effort',
  label: 'Effort',
  // The engine only reports an explicit effort level; when none is set it exposes
  // nothing, so we can't derive a level here. Match ccstatusline and label that
  // case "default" rather than inventing a level or hiding the widget. See DEC-0026.
  format: ({ snapshot, item }) => labeled(rawOf(item), 'Effort', snapshot.effort || 'default'),
});

register({
  type: 'session-id',
  label: 'Session ID',
  format: ({ snapshot, item }) =>
    snapshot.sessionId ? (rawOf(item) ? snapshot.sessionId : snapshot.sessionId.slice(0, 8)) : null,
});
register({
  type: 'context-window',
  label: 'Ctx Window',
  format: ({ snapshot, item }) =>
    snapshot.ctxWindow > 0 ? labeled(rawOf(item), 'Window', fmtNum(snapshot.ctxWindow)) : null,
});
register({
  type: 'output-style',
  label: 'Style',
  format: ({ snapshot, item }) =>
    snapshot.outputStyle ? labeled(rawOf(item), 'Style', snapshot.outputStyle) : null,
});
register({
  type: 'terminal-width',
  label: 'Width',
  format: ({ snapshot, item }) =>
    snapshot.terminalWidth > 0
      ? labeled(rawOf(item), 'Width', String(snapshot.terminalWidth))
      : null,
});
