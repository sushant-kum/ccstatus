const BASE = ['black', 'white', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray'] as const
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const fg = BASE.flatMap(c => [c, `bright${cap(c)}`])
const bg = BASE.flatMap(c => [`bg${cap(c)}`, `bgBright${cap(c)}`])
export const COLORS: ReadonlySet<string> = new Set([...fg, ...bg])
export function isColor(x: unknown): x is string {
  return typeof x === 'string' && COLORS.has(x)
}
