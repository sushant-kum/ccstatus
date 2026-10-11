import { bar, fmtDur, pct } from '../format.js';

import { register } from './registry.js';

/**
 * Computes the milliseconds remaining until an ISO timestamp, relative to now.
 * @param iso - The reset timestamp in ISO format, or `null` when unknown.
 * @param now - The current time in milliseconds since the epoch.
 * @returns   The positive milliseconds remaining, or `null` when unknown, unparseable, or past.
 */
export function until(iso: string | null, now: number): number | null {
  if (!iso) {
    return null;
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return null;
  }
  const d = t - now;
  return d > 0 ? d : null;
}

register({
  type: 'cost',
  label: 'Cost',
  format: ({ snapshot }) => (snapshot.cost === null ? null : `$${snapshot.cost.toFixed(2)}`),
});

register({
  type: 'rate-limit-5h',
  label: 'Session limit',
  format: ({ snapshot }) => {
    if (snapshot.fivePct === null) {
      return 'Session: —';
    }
    const reset = until(snapshot.fiveReset, snapshot.now);
    return `Session: ${bar(snapshot.fivePct)} ${pct(snapshot.fivePct)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
  },
});

register({
  type: 'rate-limit-week',
  label: 'Weekly limit',
  format: ({ snapshot }) => {
    if (snapshot.weekPct === null) {
      return 'Weekly: —';
    }
    const reset = until(snapshot.weekReset, snapshot.now);
    return `Weekly: ${pct(snapshot.weekPct)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
  },
});

register({
  type: 'block-timer',
  label: 'Block',
  format: ({ snapshot }) => {
    const reset = until(snapshot.blockReset, snapshot.now);
    return reset === null ? null : `Block: ${fmtDur(reset)}`;
  },
});

register({
  type: 'session-usage',
  label: 'Session %',
  format: ({ snapshot }) =>
    snapshot.fivePct === null ? null : `Session: ${pct(snapshot.fivePct)}`,
});

register({
  type: 'weekly-usage',
  label: 'Weekly %',
  format: ({ snapshot }) => (snapshot.weekPct === null ? null : `Weekly: ${pct(snapshot.weekPct)}`),
});

register({
  type: 'reset-timer',
  label: 'Reset',
  format: ({ snapshot }) => {
    const r = until(snapshot.fiveReset, snapshot.now);
    return r === null ? null : `Reset: ${fmtDur(r)}`;
  },
});

register({
  type: 'weekly-reset-timer',
  label: 'Weekly Reset',
  format: ({ snapshot }) => {
    const r = until(snapshot.weekReset, snapshot.now);
    return r === null ? null : `Weekly Reset: ${fmtDur(r)}`;
  },
});
