import type { RenderModel } from './core.js'

// No JSX: the element constructors from `$.ui.resolve(e)` take one props object
// with `children` among the props (what `h(Box, props, ...children)` builds), so
// they are called directly. This also works with stub factories in tests.
export function paintModel(model: RenderModel, el: { Box: any; Text: any }): unknown {
  const { Box, Text } = el
  const lines = model.lines.map((line, li) =>
    Box({
      key: `l${li}`,
      flexDirection: 'row',
      children: line.segments.map((seg, si) =>
        Text({ key: `s${li}-${si}`, color: seg.fg, backgroundColor: seg.bg, children: seg.text }),
      ),
    }),
  )
  return Box({ flexDirection: 'column', children: lines })
}
