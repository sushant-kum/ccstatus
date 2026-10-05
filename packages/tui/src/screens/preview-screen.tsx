import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { Preview } from '../preview.js'
import type { Config, Snapshot } from '@ccstatus/core'

const SURFACES = ['band', 'statusline', 'pane'] as const

export function PreviewScreen({ config, snapshot, source, goHome }:
  { config: Config; snapshot: Snapshot; source: 'live'|'sample'; goHome: () => void }){
  const termWidth = process.stdout.columns || 120
  const widths = [80, 120, 160, termWidth]
  const [wi, setWi] = useState(0)
  const [si, setSi] = useState(0)
  useInput((input, key) => {
    if (key.escape) goHome()
    else if (input === 'w') setWi(v => (v + 1) % widths.length)
    else if (input === 's') setSi(v => (v + 1) % SURFACES.length)
  })
  return <Box flexDirection="column">
    <Text bold>Preview</Text>
    <Text color="gray">w width ({widths[wi]}{wi === widths.length - 1 ? ' = terminal' : ''}) · s surface ({SURFACES[si]}) · esc back</Text>
    <Preview config={config} snapshot={snapshot} source={source} width={widths[wi]!} surface={SURFACES[si]!}/>
  </Box>
}
