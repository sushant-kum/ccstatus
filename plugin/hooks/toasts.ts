import type { Snapshot, ToastRule } from './core.js'

const FIELDS: Record<string, (s: Snapshot) => number | null> = {
  ctxPct: s => s.ctxPct,
  fivePct: s => s.fivePct,
  weekPct: s => s.weekPct,
  ctxTokens: s => s.ctxTokens,
  total: s => s.total,
  cost: s => s.cost,
}

export function evalWhen(when: string, snapshot: Snapshot): boolean {
  const m = /^\s*([a-zA-Z]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(when)
  if (!m) return false
  const getter = FIELDS[m[1]!]
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

export function dueToasts(
  rules: ToastRule[], snapshot: Snapshot, fired: Record<string, boolean>,
): { text: string; key: string }[] {
  const out: { text: string; key: string }[] = []
  for (const rule of rules) {
    if (!evalWhen(rule.when, snapshot)) continue
    if (rule.once && fired[rule.when]) continue
    out.push({ text: rule.text, key: rule.when })
  }
  return out
}
