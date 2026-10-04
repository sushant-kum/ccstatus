import { expect, test } from 'vitest'
import { defaultConfig } from './defaults.js'
import { loadConfig } from './validate.js'

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
  expect(config.surfaces.band.lines[0]![0]!.fg).toBeUndefined()
  expect(warnings.some(w => w.includes('fuchsia'))).toBe(true)
})

test('missing surfaces are filled from defaults', () => {
  const { config } = loadConfig({ version: 1, surfaces: { band: { enabled: false, lines: [] } } })
  expect(config.surfaces.statusline).toEqual(defaultConfig.surfaces.statusline)
  expect(config.surfaces.toasts).toEqual(defaultConfig.surfaces.toasts)
})
