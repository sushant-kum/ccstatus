import type { Snapshot, ToastRule } from './core.js'
import { evalWhen } from './core.js'

// Re-exported so existing importers (register.tsx, tests) keep their import path.
export { evalWhen }

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
