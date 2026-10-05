import { render } from 'ink-testing-library';
import { expect, test } from 'vitest';

import { App } from './app.js';

test('App renders its title', () => {
  const { lastFrame, unmount } = render(<App />);
  expect(lastFrame()).toContain('ccstatus');
  unmount();
});
