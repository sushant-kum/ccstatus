import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { SeparatorMode } from '@ccstatus/core'
import type { ScreenProps } from '../app.js'
import { SEPARATOR_PRESETS } from '../separators.js'

const MODES: SeparatorMode[] = ['powerline', 'space', 'none']
const CUSTOM = SEPARATOR_PRESETS.length          // glyph-list index of "Custom…"
const SEP_ROW = 0
const GLYPH_ROW = (i: number) => 1 + i
const INVERT_ROW = 1 + SEPARATOR_PRESETS.length + 1
const LAST_ROW = INVERT_ROW

const codeOf = (g: string) => {
  const cp = g.codePointAt(0)
  return cp === undefined ? '' : 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

export function Powerline({ config, setConfig, goHome }: ScreenProps){
  const [focus, setFocus] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const d = config.defaults
  const update = (patch: Partial<typeof d>) => setConfig({ ...config, defaults: { ...d, ...patch } })
  const isPreset = SEPARATOR_PRESETS.some(p => p.char === d.glyph)
  const hasCustom = d.glyph !== '' && !isPreset

  const activate = () => {
    if (focus === INVERT_ROW) update({ invert: !d.invert })
    else if (focus > SEP_ROW) {
      const i = focus - 1
      if (i === CUSTOM) { setDraft(''); setEditing(true) }
      else update({ glyph: SEPARATOR_PRESETS[i]!.char })
    }
  }

  useInput((input, key) => {
    if (editing) {
      if (key.escape) setEditing(false)
      else if (key.return) { if (draft) update({ glyph: draft }); setEditing(false) }
      else if (key.backspace || key.delete) setDraft(t => Array.from(t).slice(0, -1).join(''))
      else if (input && !key.ctrl && !key.meta) setDraft(t => t + input)
      return
    }
    if (key.escape) goHome()
    else if (key.upArrow) setFocus(f => Math.max(0, f - 1))
    else if (key.downArrow) setFocus(f => Math.min(LAST_ROW, f + 1))
    else if ((key.leftArrow || key.rightArrow) && focus === SEP_ROW) {
      const dir = key.rightArrow ? 1 : -1
      update({ separator: MODES[(MODES.indexOf(d.separator) + dir + MODES.length) % MODES.length]! })
    }
    else if (key.return || input === ' ') activate()
  })

  const cursor = (idx: number) => focus === idx ? '▸ ' : '  '
  const color = (idx: number) => focus === idx ? 'cyan' : undefined
  return <Box flexDirection="column">
    <Text bold>Powerline</Text>
    <Text color={color(SEP_ROW)}>{cursor(SEP_ROW)}separator: {d.separator}</Text>
    <Text dimColor>  glyph</Text>
    {SEPARATOR_PRESETS.map((p, i) => (
      <Text key={p.code} color={color(GLYPH_ROW(i))}>
        {cursor(GLYPH_ROW(i))}{d.glyph === p.char ? '(•)' : '( )'} {p.name} {p.code} {p.char}
      </Text>
    ))}
    <Text color={color(GLYPH_ROW(CUSTOM))}>
      {cursor(GLYPH_ROW(CUSTOM))}{hasCustom ? '(•)' : '( )'}{' '}
      {editing ? `Custom: ${draft}_ (enter to set, esc to cancel)`
        : hasCustom ? `Custom (${codeOf(d.glyph)}) ${d.glyph}` : 'Custom…'}
    </Text>
    <Text color={color(INVERT_ROW)}>{cursor(INVERT_ROW)}invert background: {d.invert ? 'on' : 'off'}
      <Text color="gray"> (stored, not applied)</Text></Text>
    <Text dimColor>↑/↓ move · ←/→ separator · enter select · esc back</Text>
  </Box>
}
