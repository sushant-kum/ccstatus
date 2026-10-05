import type { Snapshot, ToastRule } from './core.js';
import { evalWhen } from './core.js';

// Re-exported so existing importers (register.tsx, tests) keep their import path.
export { evalWhen };

/**
 * Select the toast rules whose conditions are currently met and not suppressed.
 * @param rules    - The configured toast rules to evaluate.
 * @param snapshot - The current snapshot the rules are evaluated against.
 * @param fired    - A map of rule keys that have already fired once.
 * @returns        The toasts that are due, each with its display text and dedupe key.
 */
export function dueToasts(
  rules: ToastRule[],
  snapshot: Snapshot,
  fired: Record<string, boolean>
): { text: string; key: string }[] {
  const out: { text: string; key: string }[] = [];
  for (const rule of rules) {
    if (!evalWhen(rule.when, snapshot)) {
      continue;
    }
    if (rule.once && fired[rule.when]) {
      continue;
    }
    out.push({ text: rule.text, key: rule.when });
  }
  return out;
}
