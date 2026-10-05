import { useMemo, useState } from 'react'
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

// Routes a menu id to its screen; `Placeholder` is the defensive fallback for an
// unrecognized id (every real menu entry maps to a screen below).
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
  // Load once: keep the warnings so we can tell the user their on-disk config was
  // rejected (otherwise opening on defaults silently clobbers a recoverable file on save).
  const loaded = useMemo(() => loadConfigFile(configPath()), [])
  const [config, setConfig] = useState<Config>(loaded.config)
  const [screen, setScreen] = useState('menu')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const snap = readSnapshot(snapshotPath())
  const width = process.stdout.columns || 120
  useInput((input)=>{ if (screen==='menu' && input==='q') exit() })

  // Returns true only when the config was actually written; on failure we surface
  // the error and stay open rather than exiting as if the save succeeded.
  const save = (): boolean => {
    try {
      setSaveWarnings(saveConfigFile(configPath(), config))
      setSaveError(null); setSaved(true)
      return true
    }
    catch (e) { setSaveError(e instanceof Error ? e.message : String(e)); return false }
  }
  const common = { config, setConfig, goHome: ()=>setScreen('menu') }

  return <Box flexDirection="column" paddingX={1}>
    {screen==='menu'
      ? <Menu onSelect={(id)=>{ if(id==='quit') exit(); else if(id==='save'){ if(save()) exit() } else setScreen(id) }}/>
      : <PlaceholderOrScreen id={screen} {...common} snapshot={snap.snapshot} source={snap.source}/>}
    {!saved && loaded.warnings.length > 0 &&
      <Text color="yellow">⚠ existing config: {loaded.warnings.join('; ')} — editing from defaults; saving replaces it (a .bak is kept)</Text>}
    {saveWarnings.length > 0 && <Text color="yellow">⚠ saved with changes: {saveWarnings.join('; ')}</Text>}
    {saveError && <Text color="red">Could not save config: {saveError}</Text>}
    <Preview config={config} snapshot={snap.snapshot} source={snap.source} width={width}/>
  </Box>
}
