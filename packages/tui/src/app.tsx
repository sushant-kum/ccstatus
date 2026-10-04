import { useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { configPath, snapshotPath, loadConfigFile, saveConfigFile } from './config-store.js'
import { readSnapshot } from './snapshot-source.js'
import { Preview } from './preview.js'
import { Menu } from './screens/menu.js'
import { Defaults } from './screens/defaults.js'
import { Items } from './screens/items.js'
import { Themes } from './screens/themes.js'
import { Powerline } from './screens/powerline.js'
import { Surfaces } from './screens/surfaces.js'
import { Import } from './screens/import.js'
import { PreviewScreen } from './screens/preview-screen.js'
import type { Config, Snapshot } from '@ccstatus/core'

export interface ScreenProps { config: Config; setConfig: (c: Config) => void; goHome: () => void }

function Placeholder({ id, goHome }: { id: string; goHome: () => void }){
  useInput((_i, key) => { if (key.escape) goHome() })
  return <Text>{id} …coming soon (esc)…</Text>
}

// Later tasks replace each placeholder case with the real screen component.
function PlaceholderOrScreen({ id, snapshot, source, ...props }: ScreenProps & { id: string; snapshot: Snapshot; source: 'live'|'sample' }){
  switch (id) {
    case 'defaults': return <Defaults {...props}/>
    case 'themes': return <Themes {...props}/>
    case 'powerline': return <Powerline {...props}/>
    case 'items': return <Items {...props}/>
    case 'surfaces': return <Surfaces {...props}/>
    case 'import': return <Import {...props}/>
    case 'preview': return <PreviewScreen {...props} snapshot={snapshot} source={source}/>
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
      : <PlaceholderOrScreen id={screen} {...common} snapshot={snap.snapshot} source={snap.source}/>}
    <Preview config={config} snapshot={snap.snapshot} source={snap.source} width={width}/>
  </Box>
}
