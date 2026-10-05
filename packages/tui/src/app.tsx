import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { configPath, snapshotPath, loadConfigFile, saveConfigFile } from './config-store.js'
import { detectModStatus, installMod, MARKETPLACE_SLUG, PLUGIN_ID, type ModStatus, type InstallResult } from './mod-status.js'
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

export interface ModProbe { detect: () => Promise<ModStatus>; install: () => Promise<InstallResult> }

export function App({ modProbe }: { modProbe?: ModProbe } = {}){
  const { exit } = useApp()
  const probe = modProbe ?? { detect: () => detectModStatus(), install: () => installMod() }
  // Load once: keep the warnings so we can tell the user their on-disk config was
  // rejected (otherwise opening on defaults silently clobbers a recoverable file on save).
  const loaded = useMemo(() => loadConfigFile(configPath()), [])
  const [config, setConfig] = useState<Config>(loaded.config)
  const [screen, setScreen] = useState('menu')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [modStatus, setModStatus] = useState<ModStatus | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<string | null>(null)
  const [installOk, setInstallOk] = useState(true)
  // Refs (not state) so the guards are correct within a single tick: `installStarted`
  // blocks a second `i` before the first install's state update re-renders;
  // `mounted` stops any async callback from setting state after unmount.
  const installStartedRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])
  const snap = readSnapshot(snapshotPath())
  const width = process.stdout.columns || 120

  // Detect the mod asynchronously so the UI paints immediately; the guard keeps
  // us from setting state after unmount, and any detection error degrades to 'unknown'.
  useEffect(() => {
    probe.detect().then((s) => { if (mountedRef.current) setModStatus(s) })
      .catch(() => { if (mountedRef.current) setModStatus('unknown') })
  }, [])

  // `i` installs the mod — menu screen only, so it never hijacks typing in an editor.
  useInput((input) => {
    if (screen !== 'menu') return
    if (input === 'q') { exit(); return }
    if (input === 'i' && modStatus === 'absent' && !installStartedRef.current) {
      installStartedRef.current = true
      setInstalling(true)
      probe.install()
        .then((r) => { if (!mountedRef.current) return; setInstallMsg(r.message); setInstallOk(r.ok); if (r.ok) setModStatus('installed') })
        .catch((e) => { if (!mountedRef.current) return; setInstallMsg(e instanceof Error ? e.message : String(e)); setInstallOk(false) })
        .finally(() => { installStartedRef.current = false; if (mountedRef.current) setInstalling(false) })
    }
  })

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
    {installMsg
      ? <Text color={installOk ? 'green' : 'red'}>{installOk ? '✓ ' : '⚠ '}{installMsg}</Text>
      : modStatus === 'absent'
        ? <Text color="yellow">⚠ ccstatus mod not installed — press i to install ({PLUGIN_ID}){installing ? ' … installing' : ''}</Text>
      : modStatus === 'disabled'
        ? <Text color="yellow">⚠ ccstatus mod installed but disabled — enable it: claude plugin enable {PLUGIN_ID}</Text>
      : modStatus === 'unknown'
        ? <Text color="yellow">⚠ couldn't check if the mod is installed — if the bar isn't showing, run: claude plugin marketplace add {MARKETPLACE_SLUG} && claude plugin install {PLUGIN_ID}</Text>
        : null}
    <Preview config={config} snapshot={snap.snapshot} source={snap.source} width={width}/>
  </Box>
}
