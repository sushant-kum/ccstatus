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
    // An unknown percentage (no reading — not yet measured, or off a subscription) shows 0%,
    // mirroring Ctx Used, rather than a "—" placeholder (see DEC-0033). The reset suffix still
    // only appears when its time is known.
    const p = snapshot.fivePct ?? 0;
    const reset = until(snapshot.fiveReset, snapshot.now);
    return `Session: ${bar(p)} ${pct(p)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
  },
});

register({
  type: 'rate-limit-week',
  label: 'Weekly limit',
  format: ({ snapshot }) => {
    const p = snapshot.weekPct ?? 0; // unknown shows 0% (DEC-0033)
    const reset = until(snapshot.weekReset, snapshot.now);
    return `Weekly: ${pct(p)}${reset !== null ? `  ${fmtDur(reset)}` : ''}`;
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
  format: ({ snapshot }) => `Session: ${pct(snapshot.fivePct ?? 0)}`, // unknown shows 0% (DEC-0033)
});

register({
  type: 'weekly-usage',
  label: 'Weekly %',
  format: ({ snapshot }) => `Weekly: ${pct(snapshot.weekPct ?? 0)}`, // unknown shows 0% (DEC-0033)
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

register({
  type: 'session-cost-rate',
  label: 'Cost/hr',
  format: ({ snapshot }) => {
    if (snapshot.cost === null) {
      return null;
    }
    const ms = snapshot.now - snapshot.startedAt;
    if (ms < 60_000) {
      return null;
    }
    return `$${(snapshot.cost / (ms / 3_600_000)).toFixed(2)}/hr`;
  },
});
