import type { Config, Item } from '../config/types.js'

export function resolveColors(item: Item, config: Config): { fg?: string; bg?: string } {
  const themeEntry = config.themes[config.theme]?.[item.type]
  return {
    fg: item.fg ?? themeEntry?.fg,
    bg: item.bg ?? themeEntry?.bg,
  }
}
