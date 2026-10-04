import { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { configPath, snapshotPath, loadConfigFile, saveConfigFile } from './config-store.js'
import { readSnapshot } from './snapshot-source.js'
import { Preview } from './preview.js'
import { Menu } from './screens/menu.js'
import { Defaults } from './screens/defaults.js'
import { Items } from './screens/items.js'
import type { Config } from '@ccstatus/core'

export interface ScreenProps { config: Config; setConfig: (c: Config) => void; goHome: () => void }

function Placeholder({ id, goHome }: { id: string; goHome: () => void }){
  useInput((_i, key) => { if (key.escape) goHome() })
  return <Text>{id} …coming soon (esc)…</Text>
}

// Later tasks replace each placeholder case with the real screen component.
function PlaceholderOrScreen({ id, ...props }: ScreenProps & { id: string }){
  switch (id) {
    case 'defaults': return <Defaults {...props}/>
    case 'items': return <Items {...props}/>
    default: return <Placeholder id={id} goHome={props.goHome}/>
  }
}

export function App(){
  const { exit } = useApp()
  const [config, setConfig] = useState<Config>(() => loadConfigFile(configPath()).config)
  const [screen, setScreen] = useState('menu')
  const snap = readSnapshot(snapshotPath())
  const width = process.stdout.columns || 120
  useInput((input)=>{ if (screen==='menu' && input==='q') exit() })

  const save = () => { try { saveConfigFile(configPath(), config) } catch {/* surfaced in UI later */} }
  const common = { config, setConfig, goHome: ()=>setScreen('menu') }

  return <Box flexDirection="column" paddingX={1}>
    {screen==='menu'
      ? <Menu onSelect={(id)=>{ if(id==='quit') exit(); else if(id==='save'){ save(); exit() } else setScreen(id) }}/>
      : <PlaceholderOrScreen id={screen} {...common}/>}
    <Preview config={config} snapshot={snap.snapshot} source={snap.source} width={width}/>
  </Box>
}
