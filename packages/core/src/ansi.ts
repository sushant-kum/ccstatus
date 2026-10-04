import type { RenderModel, Segment } from './render-model.js'

const FG: Record<string, number> = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37, gray: 90,
  brightBlack: 90, brightRed: 91, brightGreen: 92, brightYellow: 93, brightBlue: 94,
  brightMagenta: 95, brightCyan: 96, brightWhite: 97, brightGray: 97,
}
const BG: Record<string, number> = {
  bgBlack: 40, bgRed: 41, bgGreen: 42, bgYellow: 43, bgBlue: 44, bgMagenta: 45, bgCyan: 46, bgWhite: 47, bgGray: 100,
  bgBrightBlack: 100, bgBrightRed: 101, bgBrightGreen: 102, bgBrightYellow: 103, bgBrightBlue: 104,
  bgBrightMagenta: 105, bgBrightCyan: 106, bgBrightWhite: 107, bgBrightGray: 107,
}

function sgr(seg: Segment): string {
  const codes: string[] = []
  if (seg.fg && FG[seg.fg] !== undefined) codes.push(`\x1b[${FG[seg.fg]}m`)
  if (seg.bg && BG[seg.bg] !== undefined) codes.push(`\x1b[${BG[seg.bg]}m`)
  if (!codes.length) return seg.text
  return `${codes.join('')}${seg.text}\x1b[0m`
}

export function toAnsi(model: RenderModel): string {
  return model.lines.map(line => line.segments.map(sgr).join('')).join('\n')
}
