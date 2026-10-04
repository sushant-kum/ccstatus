export function fmtNum(n: number): string {
  const trim = (v: number, suffix: string) =>
    `${(v).toFixed(1).replace(/\.0$/, '')}${suffix}`
  if (Math.abs(n) >= 1_000_000) return trim(n / 1_000_000, 'M')
  if (Math.abs(n) >= 1_000) return trim(n / 1_000, 'k')
  return String(Math.round(n))
}

export function fmtDur(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function pct(x: number): string {
  return `${Math.round(x)}%`
}

export function bar(x: number, width = 5): string {
  const filled = Math.floor((Math.min(100, Math.max(0, x)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
