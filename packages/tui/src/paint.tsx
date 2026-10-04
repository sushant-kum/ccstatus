import { Box, Text } from 'ink'
import type { RenderModel } from '@ccstatus/core'
// core uses brightX / bgX / bgBrightX; Ink (chalk) wants x / xBright and adds the bg prefix itself.
const toInk = (n?: string): string | undefined => {
  if (!n) return undefined
  return n.startsWith('bright') ? n[6]!.toLowerCase() + n.slice(7) + 'Bright' : n
}
const inkColor = (fg?: string) => toInk(fg)
const inkBg = (bg?: string) => {
  if (!bg) return undefined
  return toInk(bg.startsWith('bg') ? bg[2]!.toLowerCase() + bg.slice(3) : bg)
}
export function paintModel(model: RenderModel){
  return <Box flexDirection="column">
    {model.lines.map((line,i)=>(
      <Box key={i}>{line.segments.map((s,j)=>(
        <Text key={j} color={inkColor(s.fg)} backgroundColor={inkBg(s.bg)}>{s.text}</Text>
      ))}</Box>
    ))}
  </Box>
}
