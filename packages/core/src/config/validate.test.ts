import { expect, test } from 'vitest'
import { defaultConfig } from './defaults.js'
import { loadConfig } from './validate.js'
import { WIDGET_TYPES } from './types.js'

test('empty input yields default config, no warnings', () => {
  const { config, warnings } = loadConfig(undefined)
  expect(config).toEqual(defaultConfig)
  expect(warnings).toEqual([])
})

test('garbage input falls back to default with a warning', () => {
  const { config, warnings } = loadConfig('not an object')
  expect(config.version).toBe(1)
  expect(warnings.length).toBeGreaterThan(0)
})

test('unknown widget type is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'bogus' }]] } },
  }
  const { config, warnings } = loadConfig(raw)
  expect(config.surfaces.band.lines[0]).toEqual([])
  expect(warnings.some(w => w.includes('bogus'))).toBe(true)
})

test('unknown color is stripped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'model', fg: 'fuchsia' }]] } },
  }
  const { config, warnings } = loadConfig(raw)
  expect((config.surfaces.band.lines[0]![0] as { fg?: string }).fg).toBeUndefined()
  expect(warnings.some(w => w.includes('fuchsia'))).toBe(true)
})

test('missing surfaces are filled from defaults', () => {
  const { config } = loadConfig({ version: 1, surfaces: { band: { enabled: false, lines: [] } } })
  expect(config.surfaces.statusline).toEqual(defaultConfig.surfaces.statusline)
  expect(config.surfaces.toasts).toEqual(defaultConfig.surfaces.toasts)
})

test('unknown theme color is stripped with a warning', () => {
  const raw = {
    version: 1,
    themes: {
      default: {
        model: { fg: 'fuchsia', bg: 'bgCyan' },
      },
    },
  }
  const { config, warnings } = loadConfig(raw)
  expect(config.themes.default!.model!.fg).toBeUndefined()
  expect(config.themes.default!.model!.bg).toBe('bgCyan')
  expect(warnings.some(w => w.includes('fuchsia'))).toBe(true)
})

test('empty input object yields valid config with no warnings', () => {
  const { config, warnings } = loadConfig({})
  expect(config.version).toBe(1)
  expect(warnings).toEqual([])
})

test('a config written for another version is loaded as v1 with a warning', () => {
  const { config, warnings } = loadConfig({ version: 0 })
  expect(config.version).toBe(1)
  expect(warnings.some(w => w.includes('version 0') && w.includes('loaded as version 1'))).toBe(true)
})

test('legacy custom-text metadata.text migrates to the typed text field', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'custom-text', metadata: { text: 'hello' } }]] } },
  }
  const { config } = loadConfig(raw)
  const item = config.surfaces.band.lines[0]![0]!
  expect(item.type).toBe('custom-text')
  expect((item as { text?: string }).text).toBe('hello')
})

test('every widget type survives validation (no drift between the type list and validator)', () => {
  const lines = [WIDGET_TYPES.map((type, i) => ({ id: `w${i}`, type }))]
  const { config, warnings } = loadConfig({ version: 1, surfaces: { band: { enabled: true, lines } } })
  expect(config.surfaces.band.lines[0]).toHaveLength(WIDGET_TYPES.length)
  expect(warnings).toEqual([])
})

test('negative padding is coerced to a non-negative integer', () => {
  const { config } = loadConfig({ version: 1, defaults: { padding: -1 } })
  expect(config.defaults.padding).toBeGreaterThanOrEqual(0)
  expect(Number.isInteger(config.defaults.padding)).toBe(true)
})

test('fractional padding is coerced to an integer', () => {
  const { config } = loadConfig({ version: 1, defaults: { padding: 1.5 } })
  expect(Number.isInteger(config.defaults.padding)).toBe(true)
})
