import { useMemo, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { importCcstatusline } from '@ccstatus/core'
import type { Config } from '@ccstatus/core'
import type { ScreenProps } from '../app.js'

export interface ImportProps extends ScreenProps { readFile?: (path: string) => string | null }

export function defaultReadFile(path: string): string | null {
  try { return readFileSync(path, 'utf8') } catch { return null }
}

export function detectCcstatuslinePath(): string {
  const base = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config')
  return join(base, 'ccstatusline', 'settings.json')
}

type Loaded = { ok: true; imported: Config; warnings: string[] } | { ok: false; message: string }

function load(path: string, readFile: (p: string) => string | null): Loaded {
  if (!path.trim()) return { ok: false, message: 'enter a path' }
  let text: string | null
  try { text = readFile(path) } catch { text = null }
  if (text === null) return { ok: false, message: `cannot read ${path}` }
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { ok: false, message: `invalid JSON in ${path}` } }
  try {
    const r = importCcstatusline(parsed)
    if (r.warnings.some(w => w.startsWith('input is not a ccstatusline config'))) {
      return { ok: false, message: 'not a ccstatusline config' }
    }
    return { ok: true, imported: r.config, warnings: r.warnings }
  } catch { return { ok: false, message: 'import failed' } }
}

export function Import({ config, setConfig, goHome, readFile = defaultReadFile }: ImportProps){
  const detected = useMemo(detectCcstatuslinePath, [])
  const [focus, setFocus] = useState(0)
  const [custom, setCustom] = useState('')
  const path = focus === 0 ? detected : custom
  const result = useMemo(() => load(path, readFile), [path, readFile])

  useInput((input, key) => {
    if (key.escape) { goHome(); return }
    if (key.upArrow) { setFocus(0); return }
    if (key.downArrow) { setFocus(1); return }
    if (key.return) {
      if (result.ok) setConfig({ ...config, surfaces: { ...config.surfaces, band: result.imported.surfaces.band } })
      return
    }
    if (focus === 1) {
      if (key.backspace || key.delete) setCustom(c => c.slice(0, -1))
      else if (input && !key.ctrl && !key.meta) setCustom(c => c + input)
    }
  })

  const dropped = result.ok ? result.warnings.length : 0
  const items = result.ok ? result.imported.surfaces.band.lines.map(l => l.map(i => i.type).join(', ')) : []
  const mapped = items.reduce((n, l) => n + (l ? l.split(', ').length : 0), 0)
  return <Box flexDirection="column">
    <Text bold>Import from ccstatusline</Text>
    <Text color={focus === 0 ? 'cyan' : undefined}>{focus === 0 ? '▸ ' : '  '}detected: {detected}</Text>
    <Text color={focus === 1 ? 'cyan' : undefined}>{focus === 1 ? '▸ ' : '  '}custom path: {custom}{focus === 1 ? '▏' : ''}</Text>
    {result.ok
      ? <Box flexDirection="column">
          <Text>mapped {mapped} item(s), dropped {dropped}</Text>
          {items.map((l, i) => <Text key={i}>  line {i + 1}: {l}</Text>)}
          {result.warnings.map((w, i) => <Text key={i} color="yellow">  ! {w}</Text>)}
        </Box>
      : <Text color="yellow">warning: {result.message}</Text>}
    <Text dimColor>↑/↓ source · ⏎ import (replaces band) · esc back</Text>
  </Box>
}
