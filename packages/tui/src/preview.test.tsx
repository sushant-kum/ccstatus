import { defaultConfig } from '@ccstatus/core';
import { render } from 'ink-testing-library';
import { expect, test } from 'vitest';

import { Preview } from './preview.js';
import { sampleSnapshot } from './sample-snapshot.js';

test('Preview renders the default band with content', () => {
  const { lastFrame, unmount } = render(
    <Preview config={defaultConfig} snapshot={sampleSnapshot} source="sample" width={120} />
  );
  const f = lastFrame() ?? '';
  expect(f).toContain('Ctx');
  expect(f).toContain('sample');
  unmount();
});
