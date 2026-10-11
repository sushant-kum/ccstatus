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

const bandTypes = (raw: unknown): string[] =>
  (importCcstatusline(raw).config.surfaces.band.lines[0] ?? []).map((i) => i.type);

test('maps the previously-dropped usage widgets', () => {
  expect(
    bandTypes({
      lines: [
        [
          { type: 'session-usage' },
          { type: 'reset-timer' },
          { type: 'weekly-usage' },
          { type: 'weekly-reset-timer' },
        ],
      ],
    })
  ).toEqual(['session-usage', 'reset-timer', 'weekly-usage', 'weekly-reset-timer']);
});

test('maps aliases, and thinking-effort to its own widget', () => {
  expect(
    bandTypes({
      lines: [
        [{ type: 'current-working-dir' }, { type: 'session-cost' }, { type: 'thinking-effort' }],
      ],
    })
  ).toEqual(['cwd', 'cost', 'thinking-effort']);
});

test('maps custom items with their payload', () => {
  const { config } = importCcstatusline({
    lines: [
      [
        { type: 'custom-text', customText: 'hi' },
        { type: 'custom-command', commandPath: 'echo x' },
        { type: 'custom-symbol', customSymbol: '*' },
        { type: 'flex-separator' },
      ],
    ],
  });
  const items = config.surfaces.band.lines[0] ?? [];
  expect(items[0]).toMatchObject({ type: 'custom-text', text: 'hi' });
  expect(items[1]).toMatchObject({ type: 'custom-command', command: 'echo x' });
  expect(items[2]).toMatchObject({ type: 'custom-text', text: '*' });
  expect(items[3]?.type).toBe('flex-separator');
});

test('drops an unsupported widget with a specific reason', () => {
  const { warnings } = importCcstatusline({ lines: [[{ type: 'weekly-opus-usage' }]] });
  expect(
    warnings.some((w) => w.includes('weekly-opus-usage') && /Anthropic usage API/i.test(w))
  ).toBe(true);
});

test('drops a separator with its note', () => {
  const { warnings } = importCcstatusline({ lines: [[{ type: 'separator' }]] });
  expect(warnings.some((w) => /separator/i.test(w) && /global/i.test(w))).toBe(true);
});

test('drops custom items with a missing payload and warns', () => {
  const { config, warnings } = importCcstatusline({
    lines: [
      [
        { type: 'custom-text' },
        { type: 'custom-symbol', customSymbol: '' },
        { type: 'custom-command' },
      ],
    ],
  });
  expect(config.surfaces.band.lines.flat()).toHaveLength(0);
  expect(warnings).toEqual([
    'dropped "custom-text" — no customText value',
    'dropped "custom-symbol" — no customSymbol value',
    'dropped "custom-command" — no commandPath value',
  ]);
});
