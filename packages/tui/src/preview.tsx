import { Box, Text } from 'ink'
import { render as renderBar } from '@ccstatus/core'
import type { Config, Snapshot } from '@ccstatus/core'
import { paintModel } from './paint.js'
export function Preview({ config, snapshot, source, width, surface = 'band' }:{ config:Config; snapshot:Snapshot; source:'live'|'sample'; width:number; surface?:'band'|'statusline'|'pane' }){
  const model = renderBar(config, snapshot, { surface, width })
  return <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
    <Text color="gray">live preview · {surface} · {width} cols · {source} data</Text>
    {paintModel(model)}
  </Box>
}
