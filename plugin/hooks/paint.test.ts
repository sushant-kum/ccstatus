import { describe, expect, it } from 'vitest';

import type { RenderModel } from './core.js';
import { paintModel } from './paint.js';

describe('paintModel colour mapping', () => {
  it('maps core bg/bright names to Ink names on the Text factory', () => {
    const model: RenderModel = {
      lines: [{ segments: [{ text: 'x', fg: 'brightYellow', bg: 'bgCyan' }] }],
    };
    const calls: Record<string, unknown>[] = [];
    const Box = (props: Record<string, unknown>): unknown => props;
    const Text = (props: Record<string, unknown>): unknown => {
      calls.push(props);
      return props;
    };
    paintModel(model, { Box, Text });
    expect(calls[0]?.color).toBe('yellowBright');
    expect(calls[0]?.backgroundColor).toBe('cyan');
  });
});
