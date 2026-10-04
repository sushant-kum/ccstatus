import { Box, Text } from 'ink'
import type { RenderModel } from '@ccstatus/core'
// core bg names are chalk bg methods (bgCyan); Ink's backgroundColor wants the base name (cyan).
const inkBg = (bg?: string) => bg && bg.startsWith('bg') ? bg[2]!.toLowerCase() + bg.slice(3) : bg
export function paintModel(model: RenderModel){
  return <Box flexDirection="column">
    {model.lines.map((line,i)=>(
      <Box key={i}>{line.segments.map((s,j)=>(
        <Text key={j} color={s.fg} backgroundColor={inkBg(s.bg)}>{s.text}</Text>
      ))}</Box>
    ))}
  </Box>
}
