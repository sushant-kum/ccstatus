import { describe, expect, it } from 'vitest';

import type { RenderModel } from './core.js';
import { paintModel } from './paint.js';

describe('paintModel colour mapping', () => {
  it('maps core 256-color indices to hex on the Text factory', () => {
    const model: RenderModel = {
      lines: [{ segments: [{ text: 'x', fg: 208, bg: 45 }] }],
    };
    const calls: Record<string, unknown>[] = [];
    const Box = (props: Record<string, unknown>): unknown => props;
    const Text = (props: Record<string, unknown>): unknown => {
      calls.push(props);
      return props;
    };
    paintModel(model, { Box, Text });
    expect(calls[0]?.color).toBe('#ff8700');
    expect(calls[0]?.backgroundColor).toBe('#00d7ff');
  });
});
