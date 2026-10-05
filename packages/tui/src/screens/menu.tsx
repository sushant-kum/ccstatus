import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
const ITEMS = [
  ['items','Edit items'],['themes','Themes'],['powerline','Powerline & separators'],
  ['surfaces','Surfaces'],['defaults','Global defaults'],['preview','Preview'],
  ['import','Import from ccstatusline'],['save','Save & quit'],['quit','Quit without saving'],
] as const
export function Menu({ onSelect }:{ onSelect:(id:string)=>void }){
  const [i,setI] = useState(0)
  useInput((input,key)=>{
    if(key.upArrow) setI(v=>Math.max(0,v-1))
    else if(key.downArrow) setI(v=>Math.min(ITEMS.length-1,v+1))
    else if(key.return) onSelect(ITEMS[i]![0])
  })
  return <Box flexDirection="column">
    <Text bold>ccstatus · configurator</Text>
    {ITEMS.map(([id,label],idx)=>(
      <Text key={id} color={idx===i?'cyan':undefined}>{idx===i?'▸ ':'  '}{label}</Text>
    ))}
  </Box>
}
