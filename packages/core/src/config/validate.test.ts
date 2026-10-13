import { expect, test } from 'vitest';

import { defaultConfig } from './defaults.js';
import { WIDGET_TYPES } from './types.js';
import { loadConfig } from './validate.js';

test('empty input yields default config, no warnings', () => {
  const { config, warnings } = loadConfig(undefined);
  expect(config).toEqual(defaultConfig);
  expect(warnings).toEqual([]);
});

test('garbage input falls back to default with a warning', () => {
  const { config, warnings } = loadConfig('not an object');
  expect(config.version).toBe(1);
  expect(warnings.length).toBeGreaterThan(0);
});

test('unknown widget type is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'bogus' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.lines[0]).toEqual([]);
  expect(warnings.some((w) => w.includes('bogus'))).toBe(true);
});

test('missing surfaces are filled from defaults', () => {
  const { config } = loadConfig({ version: 1, surfaces: { band: { enabled: false, lines: [] } } });
  expect(config.surfaces.statusline).toEqual(defaultConfig.surfaces.statusline);
  expect(config.surfaces.toasts).toEqual(defaultConfig.surfaces.toasts);
});

test('empty input object yields valid config with no warnings', () => {
  const { config, warnings } = loadConfig({});
  expect(config.version).toBe(1);
  expect(warnings).toEqual([]);
});

test('a config written for another version is loaded as v1 with a warning', () => {
  const { config, warnings } = loadConfig({ version: 0 });
  expect(config.version).toBe(1);
  expect(warnings.some((w) => w.includes('version 0') && w.includes('loaded as version 1'))).toBe(
    true
  );
});

test('legacy custom-text metadata.text migrates to the typed text field', () => {
  const raw = {
    version: 1,
    surfaces: {
      band: {
        enabled: true,
        lines: [[{ id: 'a', type: 'custom-text', metadata: { text: 'hello' } }]],
      },
    },
  };
  const { config } = loadConfig(raw);
  const item = config.surfaces.band.lines[0]?.[0];
  if (!item) {
    throw new Error('expected a band item');
  }
  expect(item.type).toBe('custom-text');
  expect((item as { text?: string }).text).toBe('hello');
});

test('every widget type survives validation (no drift between the type list and validator)', () => {
  const lines = [WIDGET_TYPES.map((type, i) => ({ id: `w${i}`, type }))];
  const { config, warnings } = loadConfig({
    version: 1,
    surfaces: { band: { enabled: true, lines } },
  });
  expect(config.surfaces.band.lines[0]).toHaveLength(WIDGET_TYPES.length);
  expect(warnings).toEqual([]);
});

test('a toast rule with an invalid `when` is dropped with a warning; valid ones are kept', () => {
  const raw = {
    version: 1,
    surfaces: {
      toasts: {
        enabled: true,
        rules: [
          { when: 'ctxPct > 80', text: 'high' },
          { when: 'ctxPercent > 80', text: 'typo field' },
        ],
      },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.toasts.rules).toHaveLength(1);
  expect(config.surfaces.toasts.rules[0]?.when).toBe('ctxPct > 80');
  expect(warnings.some((w) => w.includes('ctxPercent'))).toBe(true);
});

test('negative padding is coerced to a non-negative integer', () => {
  const { config } = loadConfig({ version: 1, defaults: { padding: -1 } });
  expect(config.defaults.padding).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(config.defaults.padding)).toBe(true);
});

test('fractional padding is coerced to an integer', () => {
  const { config } = loadConfig({ version: 1, defaults: { padding: 1.5 } });
  expect(Number.isInteger(config.defaults.padding)).toBe(true);
});

test('linked surfaces are synced to the canonical (band) layout on load', () => {
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] },
      statusline: { enabled: true, linked: true, lines: [[{ id: 'b', type: 'cwd' }]] },
      pane: { enabled: true, linked: true, lines: [[{ id: 'c', type: 'git-branch' }]] },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBe(true);
  expect(config.surfaces.band.lines[0]?.[0]?.type).toBe('model'); // band is canonical
  expect(config.surfaces.statusline.lines).toEqual(config.surfaces.band.lines);
  expect(config.surfaces.pane.lines).toEqual(config.surfaces.band.lines);
  expect(warnings.some((w) => w.includes('diverged'))).toBe(true);
});

test('a lone linked flag is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBeUndefined();
  expect(warnings.some((w) => w.includes('lone surface link'))).toBe(true);
});

test('already-identical linked surfaces load without a diverge warning', () => {
  const line = [{ id: 'a', type: 'model' }];
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [line] },
      statusline: { enabled: true, linked: true, lines: [line] },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.band.linked).toBe(true);
  expect(config.surfaces.statusline.linked).toBe(true);
  expect(warnings.some((w) => w.includes('diverged'))).toBe(false);
});

test('normalization deep-clones linked lines (no shared references)', () => {
  const raw = {
    version: 1,
    surfaces: {
      band: { enabled: true, linked: true, lines: [[{ id: 'a', type: 'model' }]] },
      pane: { enabled: true, linked: true, lines: [[{ id: 'b', type: 'cwd' }]] },
    },
  };
  const { config } = loadConfig(raw);
  expect(config.surfaces.pane.lines[0]).not.toBe(config.surfaces.band.lines[0]);
});

test('divergent linked surfaces sync to statusline when band is not linked', () => {
  const raw = {
    version: 1,
    surfaces: {
      statusline: { enabled: true, linked: true, lines: [[{ id: 's', type: 'model' }]] },
      pane: { enabled: true, linked: true, lines: [[{ id: 'p', type: 'cwd' }]] },
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.surfaces.statusline.linked).toBe(true);
  expect(config.surfaces.pane.linked).toBe(true);
  expect(config.surfaces.pane.lines).toEqual(config.surfaces.statusline.lines);
  // statusline is canonical (band is not linked)
  expect(config.surfaces.statusline.lines[0]?.[0]?.type).toBe('model');
  expect(config.surfaces.band.linked).toBeUndefined();
  expect(warnings.some((w) => w.includes('diverged'))).toBe(true);
});

test('a per-item color is dropped with a warning', () => {
  const raw = {
    version: 1,
    surfaces: { band: { enabled: true, lines: [[{ id: 'a', type: 'model', fg: 'bgCyan' }]] } },
  };
  const { config, warnings } = loadConfig(raw);
  const item = config.surfaces.band.lines[0]?.[0];
  expect(item?.type).toBe('model');
  expect((item as { fg?: string } | undefined)?.fg).toBeUndefined();
  expect(warnings.some((w) => w.includes('per-item color'))).toBe(true);
});

test('a legacy per-widget theme is dropped and builtins are used', () => {
  const raw = {
    version: 1,
    theme: 'default',
    themes: { default: { model: { fg: 'black', bg: 'bgCyan' } } },
  };
  const { config, warnings } = loadConfig(raw);
  // With every custom theme dropped, the full builtin set is restored (not an empty default).
  expect(Object.keys(config.themes)).toHaveLength(Object.keys(defaultConfig.themes).length);
  expect(config.themes.default?.length ?? 0).toBeGreaterThan(0);
  expect(config.theme).toBe('default');
  expect(warnings.some((w) => w.includes('old per-widget format'))).toBe(true);
});

test('a non-array, non-object theme value is dropped with a "not a palette array" warning', () => {
  const { config, warnings } = loadConfig({ version: 1, themes: { mine: 42 } });
  expect(config.themes.mine).toBeUndefined();
  expect(warnings.some((w) => w.includes('not a palette array'))).toBe(true);
  // It must NOT claim the value was the legacy per-widget object format.
  expect(warnings.some((w) => w.includes('old per-widget format'))).toBe(false);
});

test('defining one custom theme keeps default but does not fold in the other builtins', () => {
  const raw = { version: 1, theme: 'mine', themes: { mine: [{ fg: 231, bg: 160 }] } };
  const { config } = loadConfig(raw);
  expect(Object.keys(config.themes).sort()).toEqual(['default', 'mine']);
  expect(config.themes.nord).toBeUndefined();
});

test('a non-object slot is replaced with an empty slot, preserving later positions', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: { mine: [{ fg: 231, bg: 160 }, null, { bg: 20 }] },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{ fg: 231, bg: 160 }, {}, { bg: 20 }]);
  expect(warnings.some((w) => w.includes('slot 1'))).toBe(true);
});

test('a positional palette theme with a bad slot color is stripped with a warning', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: {
      mine: [
        { fg: 16, bg: 44 },
        { fg: 999, bg: 20 },
      ],
    },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine?.[1]).toEqual({ bg: 20 });
  expect(warnings.some((w) => w.includes('999'))).toBe(true);
});

test('non-mappable slot colors (-1, garbage) are dropped with warnings and never throw', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: { mine: [{ fg: -1, bg: 'garbage' }, { fg: 45 }] },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{}, { fg: 45 }]);
  expect(warnings.some((w) => w.includes('-1'))).toBe(true);
  expect(warnings.some((w) => w.includes('garbage'))).toBe(true);
});

test('an unknown active theme name falls back to default with a warning', () => {
  const { config, warnings } = loadConfig({ version: 1, theme: 'ghost', themes: {} });
  expect(config.theme).toBe('default');
  expect(warnings.some((w) => w.includes('ghost') && w.includes('default'))).toBe(true);
});

test('a valid positional palette theme is preserved', () => {
  const raw = { version: 1, theme: 'mine', themes: { mine: [{ fg: 231, bg: 160 }] } };
  const { config } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{ fg: 231, bg: 160 }]);
  expect(config.theme).toBe('mine');
});

test('an active theme name matching a prototype key falls back to default', () => {
  const { config, warnings } = loadConfig({ version: 1, theme: 'toString', themes: {} });
  expect(config.theme).toBe('default');
  expect(Array.isArray(config.themes.default)).toBe(true);
  expect(warnings.some((w) => w.includes('toString') && w.includes('default'))).toBe(true);
});

test('a legacy string color migrates to its index with a warning', () => {
  const raw = {
    version: 1,
    theme: 'mine',
    themes: { mine: [{ fg: 'brightWhite', bg: 'bgCyan' }] },
  };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.mine).toEqual([{ fg: 231, bg: 44 }]);
  expect(warnings.some((w) => w.includes('256-color'))).toBe(true);
});

test('a 0-15 index migrates to its cube equivalent with a warning', () => {
  const { config, warnings } = loadConfig({ version: 1, theme: 'm', themes: { m: [{ bg: 7 }] } });
  expect(config.themes.m).toEqual([{ bg: 250 }]);
  expect(warnings.some((w) => w.includes('dims'))).toBe(true);
});

test('an out-of-range / garbage color drops the field with a warning, never throws', () => {
  const raw = { version: 1, theme: 'm', themes: { m: [{ fg: 300, bg: 'notacolor' }] } };
  const { config, warnings } = loadConfig(raw);
  expect(config.themes.m).toEqual([{}]);
  expect(warnings.length).toBeGreaterThan(0);
});
