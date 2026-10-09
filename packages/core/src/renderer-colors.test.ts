import { describe, expect, it } from 'vitest';

import { rendererBg, rendererColor } from './renderer-colors.js';

describe('rendererColor', () => {
  it('passes base names through', () => {
    expect(rendererColor('cyan')).toBe('cyan');
    expect(rendererColor('red')).toBe('red');
  });
  it('reorders brightX to xBright', () => {
    expect(rendererColor('brightYellow')).toBe('yellowBright');
    expect(rendererColor('brightBlack')).toBe('blackBright');
  });
  it('maps brightGray to grayBright — the documented quirk (Ink has no grayBright, so it renders uncoloured)', () => {
    expect(rendererColor('brightGray')).toBe('grayBright');
  });
  it('returns undefined for no input', () => {
    expect(rendererColor(undefined)).toBeUndefined();
  });
});

describe('rendererBg', () => {
  it('strips the bg prefix to the base name', () => {
    expect(rendererBg('bgCyan')).toBe('cyan');
    expect(rendererBg('bgRed')).toBe('red');
  });
  it('maps bgBrightX to xBright', () => {
    expect(rendererBg('bgBrightYellow')).toBe('yellowBright');
  });
  it('maps bgBrightGray to grayBright — the documented quirk (renders uncoloured through Ink)', () => {
    expect(rendererBg('bgBrightGray')).toBe('grayBright');
  });
  it('returns undefined for no input', () => {
    expect(rendererBg(undefined)).toBeUndefined();
  });
});
