import { describe, expect, it } from 'vitest';

import { rendererBg, rendererColor } from './renderer-colors.js';
import { indexToHex } from './theme/xterm256.js';

describe('rendererColor', () => {
  it('maps an index to hex', () => {
    expect(rendererColor(16)).toBe('#000000');
  });
  it('returns undefined for no input', () => {
    expect(rendererColor(undefined)).toBeUndefined();
  });
});

describe('rendererBg', () => {
  it('maps an index to hex', () => {
    expect(rendererBg(44)).toBe(indexToHex(44));
  });
  it('returns undefined for no input', () => {
    expect(rendererBg(undefined)).toBeUndefined();
  });
});
