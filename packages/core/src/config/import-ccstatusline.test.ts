import { expect, test } from 'vitest'
import { importCcstatusline } from './import-ccstatusline.js'

const ccsl = {
  version: 4,
  lines: [
    [
      { id: '1', type: 'version' },
      { id: '2', type: 'context-percentage', backgroundColor: 'bgBrightYellow' },
      { id: '3', type: 'totally-unknown' },
    ],
  ],
}

test('maps known items into the band surface', () => {
  const { config, warnings } = importCcstatusline(ccsl)
  const line = config.surfaces.band.lines[0]!
  expect(line.map(i => i.type)).toEqual(['version', 'context-percentage'])
  expect(line[1]!.bg).toBe('bgBrightYellow')
  expect(config.surfaces.band.enabled).toBe(true)
  expect(warnings.some(w => w.includes('totally-unknown'))).toBe(true)
})

test('garbage input yields a valid default config with a warning', () => {
  const { config, warnings } = importCcstatusline(42)
  expect(config.version).toBe(1)
  expect(warnings.length).toBeGreaterThan(0)
})
