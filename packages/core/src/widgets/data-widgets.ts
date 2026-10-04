import { fmtDur, fmtNum, pct } from '../format.js'
import { register } from './registry.js'
import type { WidgetContext } from './types.js'

const labeled = (raw: boolean | undefined, label: string, value: string) =>
  raw ? value : `${label}: ${value}`

register({ type: 'model', label: 'Model', format: ({ snapshot }) => snapshot.model || null })
register({
  type: 'version', label: 'Version',
  format: ({ snapshot, item }) => (snapshot.version ? (item.rawValue ? snapshot.version : `v${snapshot.version}`) : null),
})
register({ type: 'context-length', label: 'Ctx', format: ({ snapshot, item }) => labeled(item.rawValue, 'Ctx', fmtNum(snapshot.ctxTokens)) })
register({ type: 'context-percentage', label: 'Ctx Used', format: ({ snapshot, item }) => labeled(item.rawValue, 'Ctx Used', pct(snapshot.ctxPct)) })
register({ type: 'tokens-input', label: 'In', format: ({ snapshot, item }) => labeled(item.rawValue, 'In', fmtNum(snapshot.input)) })
register({ type: 'tokens-output', label: 'Out', format: ({ snapshot, item }) => labeled(item.rawValue, 'Out', fmtNum(snapshot.output)) })
register({ type: 'tokens-cached', label: 'Cached', format: ({ snapshot, item }) => labeled(item.rawValue, 'Cached', fmtNum(snapshot.cached)) })
register({ type: 'tokens-total', label: 'Total', format: ({ snapshot, item }) => labeled(item.rawValue, 'Total', fmtNum(snapshot.total)) })
register({ type: 'session-clock', label: 'Session', format: ({ snapshot, item }) => labeled(item.rawValue, 'Session', fmtDur(snapshot.now - snapshot.startedAt)) })
register({
  type: 'cwd', label: 'cwd',
  format: ({ snapshot }: WidgetContext) => {
    if (!snapshot.cwd) return null
    const parts = snapshot.cwd.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? snapshot.cwd
  },
})
