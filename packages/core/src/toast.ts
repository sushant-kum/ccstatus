import type { Snapshot } from './snapshot.js'

// Numeric snapshot fields a toast `when` rule may compare against. Single source
// of truth for both evaluation (plugin) and validation (TUI), so they can't drift.
export const TOAST_FIELDS: Record<string, (s: Snapshot) => number | null> = {
  ctxPct: s => s.ctxPct,
  fivePct: s => s.fivePct,
  weekPct: s => s.weekPct,
  ctxTokens: s => s.ctxTokens,
  total: s => s.total,
  cost: s => s.cost,
}

const WHEN_RE = /^\s*([a-zA-Z]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/

// A `when` is valid iff it parses and names a known field. Use this everywhere a
// rule is authored or checked, so "valid in the TUI" matches "fires in the plugin".
export function isValidWhen(when: string): boolean {
  const m = WHEN_RE.exec(when)
  return m !== null && m[1]! in TOAST_FIELDS
}

export function evalWhen(when: string, snapshot: Snapshot): boolean {
  const m = WHEN_RE.exec(when)
  if (!m) return false
  const getter = TOAST_FIELDS[m[1]!]
  if (!getter) return false
  const value = getter(snapshot)
  if (value === null || value === undefined || Number.isNaN(value)) return false
  const n = Number(m[3])
  switch (m[2]) {
    case '>': return value > n
    case '>=': return value >= n
    case '<': return value < n
    case '<=': return value <= n
    case '==': return value === n
    default: return false
  }
}
