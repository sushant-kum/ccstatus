import { Box, Text } from 'ink'
import { render as renderBar } from '@ccstatus/core'
import type { Config, Snapshot } from '@ccstatus/core'
import { paintModel } from './paint.js'
export function Preview({ config, snapshot, source, width }:{ config:Config; snapshot:Snapshot; source:'live'|'sample'; width:number }){
  const model = renderBar(config, snapshot, { surface:'band', width })
  return <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
    <Text color="gray">live preview · band · {width} cols · {source} data</Text>
    {paintModel(model)}
  </Box>
}
