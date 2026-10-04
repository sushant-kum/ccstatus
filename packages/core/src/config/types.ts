export type Align = 'left' | 'center' | 'right'
export type SeparatorMode = 'powerline' | 'space' | 'none'

export type WidgetType =
  | 'model' | 'version' | 'context-length' | 'context-percentage'
  | 'tokens-input' | 'tokens-output' | 'tokens-cached' | 'tokens-total'
  | 'session-clock' | 'cwd'
  | 'git-branch' | 'git-changes' | 'git-worktree' | 'git-root-dir'
  | 'cost' | 'rate-limit-5h' | 'rate-limit-week' | 'block-timer'
  | 'custom-text' | 'custom-command' | 'flex-separator'

export type Item = {
  id: string
  type: WidgetType
  fg?: string
  bg?: string
  merge?: boolean
  align?: Align
  rawValue?: boolean
  metadata?: Record<string, unknown>
}

export type SurfaceLayout = { enabled: boolean; lines: Item[][] }
export type ToastRule = { when: string; text: string; once?: boolean }
export type ToastSurface = { enabled: boolean; rules: ToastRule[] }
export type Theme = Record<string, { fg?: string; bg?: string }>
export type Defaults = { separator: SeparatorMode; padding: number; align: Align }

export type Config = {
  version: 1
  theme: string
  themes: Record<string, Theme>
  defaults: Defaults
  surfaces: {
    band: SurfaceLayout
    statusline: SurfaceLayout
    pane: SurfaceLayout
    toasts: ToastSurface
  }
}
