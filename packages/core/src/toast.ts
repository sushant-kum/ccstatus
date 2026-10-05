import type { Snapshot } from './snapshot.js';

// Numeric snapshot fields a toast `when` rule may compare against. Single source
// of truth for both evaluation (plugin) and validation (TUI), so they can't drift.
export const TOAST_FIELDS: Record<string, (s: Snapshot) => number | null> = {
  ctxPct: (s) => s.ctxPct,
  fivePct: (s) => s.fivePct,
  weekPct: (s) => s.weekPct,
  ctxTokens: (s) => s.ctxTokens,
  total: (s) => s.total,
  cost: (s) => s.cost,
};

const WHEN_RE = /^\s*([a-zA-Z]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Reports whether a toast `when` rule parses and names a known snapshot field.
 *
 * Used everywhere a rule is authored or checked, so "valid in the TUI" matches
 * "fires in the plugin".
 * @param when - The `when` expression to validate.
 * @returns    `true` when the expression is well-formed and references a known field.
 */
export function isValidWhen(when: string): boolean {
  const m = WHEN_RE.exec(when);
  if (m === null) {
    return false;
  }
  const field = m[1];
  return field !== undefined && field in TOAST_FIELDS;
}

/**
 * Evaluates a toast `when` rule against a snapshot.
 * @param when     - The `when` expression to evaluate.
 * @param snapshot - The snapshot providing the field values.
 * @returns        `true` when the expression is valid and its comparison holds for the snapshot.
 */
export function evalWhen(when: string, snapshot: Snapshot): boolean {
  const m = WHEN_RE.exec(when);
  if (!m) {
    return false;
  }
  const field = m[1];
  const getter = field === undefined ? undefined : TOAST_FIELDS[field];
  if (!getter) {
    return false;
  }
  const value = getter(snapshot);
  if (value === null || value === undefined || Number.isNaN(value)) {
    return false;
  }
  const n = Number(m[3]);
  switch (m[2]) {
    case '>':
      return value > n;
    case '>=':
      return value >= n;
    case '<':
      return value < n;
    case '<=':
      return value <= n;
    case '==':
      return value === n;
    default:
      return false;
  }
}
