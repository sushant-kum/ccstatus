import { expect, test } from 'vitest';

import { importCcstatusline } from './import-ccstatusline.js';

const ccsl = {
  version: 4,
  lines: [
    [
      { id: '1', type: 'version' },
      { id: '2', type: 'context-percentage', backgroundColor: 'bgBrightYellow' },
      { id: '3', type: 'totally-unknown' },
    ],
  ],
};

test('maps known items into the band surface', () => {
  const { config, warnings } = importCcstatusline(ccsl);
  const [line] = config.surfaces.band.lines;
  if (!line) {
    throw new Error('expected a band line');
  }
  expect(line.map((i) => i.type)).toEqual(['version', 'context-percentage']);
  expect((line[1] as { bg?: string }).bg).toBe('bgBrightYellow');
  expect(config.surfaces.band.enabled).toBe(true);
  expect(warnings.some((w) => w.includes('totally-unknown'))).toBe(true);
});

test('garbage input yields a valid default config with a warning', () => {
  const { config, warnings } = importCcstatusline(42);
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});

test('no throw on bad items (null, primitives)', () => {
  const { config, warnings } = importCcstatusline({
    version: 1,
    lines: [[null, 5, { id: 'v', type: 'version' }]],
  });
  const [line] = config.surfaces.band.lines;
  if (!line) {
    throw new Error('expected a band line');
  }
  expect(line).toHaveLength(1);
  expect(line[0]?.type).toBe('version');
  expect(warnings.some((w) => w.includes('non-object'))).toBe(true);
});

test('prototype keys are dropped', () => {
  const { config, warnings } = importCcstatusline({
    version: 1,
    lines: [[{ id: 'x', type: 'toString' }]],
  });
  const [line] = config.surfaces.band.lines;
  if (!line) {
    throw new Error('expected a band line');
  }
  expect(line).toHaveLength(0);
  expect(warnings.some((w) => w.includes('toString'))).toBe(true);
});
