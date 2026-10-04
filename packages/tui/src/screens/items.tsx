import { useState, type ReactNode } from 'react'
import { Box, Text, useInput } from 'ink'
import { registry } from '@ccstatus/core'
import type { Align, Config, Item, WidgetType } from '@ccstatus/core'
import type { ScreenProps } from '../app.js'
import { NAMED_COLORS } from '../named-colors.js'
import { inkBg, inkColor } from '../paint.js'

// Keys — strip: ←/→ select · [ / ] move item left/right · a add · x remove · e edit · tab surface · esc home
//        editor: ↑/↓ field · ←/→ change · esc back to strip
//        picker: ↑/↓ choose · enter add · esc cancel
// v1 operates on line 0 of each surface (existing extra lines are preserved untouched).
const SURFACES = ['band', 'statusline', 'pane'] as const
type Surface = typeof SURFACES[number]
const FIELDS = ['fg', 'bg', 'raw', 'merge', 'align'] as const
const ALIGNS: Align[] = ['left', 'center', 'right']
const FG = NAMED_COLORS.filter(c => !c.startsWith('bg'))
const BG = ['(none)', ...NAMED_COLORS.filter(c => c.startsWith('bg'))]
const WIDGETS = Object.values(registry) as { type: WidgetType; label: string }[]

const wrap = (i: number, n: number) => (i + n) % n


function Chip({ item, selected }: { item: Item; selected: boolean }){
  return <Text inverse={selected} color={inkColor(item.fg)} backgroundColor={inkBg(item.bg)}>[ {item.type} ]</Text>
}

function Swatch({ name, bg }: { name?: string; bg?: boolean }){
  if (!name) return <Text dimColor>(none)</Text>
  return <Text color={bg ? undefined : inkColor(name)} backgroundColor={bg ? inkBg(name) : undefined}> {name} </Text>
}

export function Items({ config, setConfig, goHome }: ScreenProps){
  const [surface, setSurface] = useState<Surface>('band')
  const [sel, setSel] = useState(0)
  const [mode, setMode] = useState<'strip' | 'editor' | 'picker'>('strip')
  const [field, setField] = useState(0)
  const [pick, setPick] = useState(0)

  const items: Item[] = config.surfaces[surface].lines[0] ?? []
  const cur = items[Math.min(sel, items.length - 1)]
  const idx = cur ? items.indexOf(cur) : -1

  const commit = (next: Item[]) => {
    const s = config.surfaces[surface]
    const lines = [next, ...s.lines.slice(1)]
    const c: Config = { ...config, surfaces: { ...config.surfaces, [surface]: { ...s, lines } } }
    setConfig(c)
  }
  const patch = (p: Partial<Item>) => {
    if (idx < 0) return
    const item = { ...items[idx]!, ...p }
    for (const k of Object.keys(p) as (keyof Item)[]) if (item[k] === undefined) delete item[k]
    commit(items.map((it, i) => (i === idx ? item : it)))
  }
  const cycleColor = (list: string[], cur: string | undefined, dir: 1 | -1) => {
    const n = list[wrap(Math.max(0, list.indexOf(cur ?? '(none)')) + dir + list.length, list.length)]!
    return n === '(none)' ? undefined : n
  }
  const change = (dir: 1 | -1) => {
    if (!cur) return
    const f = FIELDS[field]
    if (f === 'fg') patch({ fg: cycleColor(FG, cur.fg, dir) })
    else if (f === 'bg') patch({ bg: cycleColor(BG, cur.bg, dir) })
    else if (f === 'raw') patch({ rawValue: !cur.rawValue })
    else if (f === 'merge') patch({ merge: !cur.merge })
    else patch({ align: ALIGNS[wrap(ALIGNS.indexOf(cur.align ?? 'left') + dir + 3, 3)]! })
  }
  const move = (dir: 1 | -1) => {
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[idx], next[j]] = [next[j]!, next[idx]!]
    commit(next)
    setSel(j)
  }

  useInput((input, key) => {
    if (mode === 'picker') {
      if (key.escape) setMode('strip')
      else if (key.upArrow) setPick(p => wrap(p - 1 + WIDGETS.length, WIDGETS.length))
      else if (key.downArrow) setPick(p => wrap(p + 1, WIDGETS.length))
      else if (key.return) {
        const type = WIDGETS[pick]!.type
        commit([...items, { id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type }])
        setSel(items.length)
        setMode('strip')
      }
    } else if (mode === 'editor') {
      if (key.escape) setMode('strip')
      else if (key.upArrow) setField(f => Math.max(0, f - 1))
      else if (key.downArrow) setField(f => Math.min(FIELDS.length - 1, f + 1))
      else if (key.leftArrow) change(-1)
      else if (key.rightArrow) change(1)
    } else {
      if (key.escape) goHome()
      else if (key.tab) { setSurface(s => SURFACES[wrap(SURFACES.indexOf(s) + 1, SURFACES.length)]!); setSel(0) }
      else if (key.leftArrow) setSel(Math.max(0, idx - 1))
      else if (key.rightArrow) setSel(Math.min(items.length - 1, idx + 1))
      else if (input === '[') move(-1)
      else if (input === ']') move(1)
      else if (input === 'a') { setPick(0); setMode('picker') }
      else if (input === 'x' && idx >= 0) { commit(items.filter((_, i) => i !== idx)); setSel(Math.max(0, idx - 1)) }
      else if (input === 'e' && idx >= 0) { setField(0); setMode('editor') }
    }
  })

  const row = (i: number, name: string, value: ReactNode) => (
    <Box key={name}><Text color={mode === 'editor' && field === i ? 'cyan' : undefined}>
      {mode === 'editor' && field === i ? '▸ ' : '  '}{name}: </Text>{value}</Box>
  )

  return <Box flexDirection="column">
    <Box>{SURFACES.map(s => (
      <Text key={s} bold={s === surface} color={s === surface ? 'cyan' : undefined}> {s === surface ? `[${s}]` : s} </Text>
    ))}</Box>
    <Box>{items.length === 0 ? <Text dimColor>(no items — press a)</Text>
      : items.map((it, i) => <Chip key={it.id} item={it} selected={i === idx}/>)}</Box>
    {mode === 'picker' ? <Box flexDirection="column" marginTop={1}>
      <Text bold>Add widget</Text>
      {WIDGETS.map((w, i) => (
        <Text key={w.type} color={i === pick ? 'cyan' : undefined}>{i === pick ? '▸ ' : '  '}{w.type} <Text dimColor>{w.label}</Text></Text>
      ))}
    </Box> : cur && <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text>type: {cur.type}</Text>
      {row(0, 'fg', <Swatch name={cur.fg}/>)}
      {row(1, 'bg', <Swatch name={cur.bg} bg/>)}
      {row(2, 'raw', <Text>{cur.rawValue ? 'on' : 'off'}</Text>)}
      {row(3, 'merge', <Text>{cur.merge ? 'on' : 'off'}</Text>)}
      {row(4, 'align', <Text>{cur.align ?? 'left'}</Text>)}
    </Box>}
    <Text dimColor>{mode === 'strip' ? '←/→ select · [/] move · a add · x remove · e edit · tab surface · esc back'
      : mode === 'editor' ? '↑/↓ field · ←/→ change · esc done' : '↑/↓ choose · enter add · esc cancel'}</Text>
  </Box>
}
