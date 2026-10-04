import type { Config } from './types.js'

export const defaultConfig: Config = {
  version: 1,
  theme: 'default',
  themes: {
    default: {
      model: { fg: 'black', bg: 'bgCyan' },
      version: { fg: 'white', bg: 'bgBlue' },
      'context-percentage': { fg: 'black', bg: 'bgBrightYellow' },
      'git-branch': { fg: 'black', bg: 'bgCyan' },
      'git-changes': { fg: 'white', bg: 'bgBrightBlack' },
    },
  },
  defaults: { separator: 'powerline', padding: 1, align: 'left' },
  surfaces: {
    band: {
      enabled: true,
      lines: [
        [
          { id: 'd-version', type: 'version' },
          { id: 'd-model', type: 'model' },
          { id: 'd-ctx', type: 'context-length' },
          { id: 'd-ctxp', type: 'context-percentage' },
        ],
      ],
    },
    statusline: { enabled: false, lines: [[]] },
    pane: { enabled: false, lines: [[]] },
    toasts: {
      enabled: true,
      rules: [{ when: 'ctxPct>80', text: 'Context over 80%', once: true }],
    },
  },
}
