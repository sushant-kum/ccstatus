import type { RenderModel } from './core.js';
import { rendererBg, rendererColor } from './core.js';

/**
 * An element factory taking one props object (with `children` among the props).
 */
type ElementFactory = (props: Record<string, unknown>) => unknown;

// No JSX: the element constructors from `$.ui.resolve(e)` take one props object
// with `children` among the props (what `h(Box, props, ...children)` builds), so
// they are called directly. This also works with stub factories in tests.
/**
 * Paint a render model into engine elements as a column of styled rows.
 * @param model   - The surface-agnostic render model to paint.
 * @param el      - The element factories to build the tree with.
 * @param el.Box  - The `Box` element factory.
 * @param el.Text - The `Text` element factory.
 * @returns       The root element produced by the `Box` factory.
 */
export function paintModel(
  model: RenderModel,
  el: { Box: ElementFactory; Text: ElementFactory }
): unknown {
  const { Box, Text } = el;
  const lines = model.lines.map((line, li) =>
    Box({
      key: `l${li}`,
      flexDirection: 'row',
      children: line.segments.map((seg, si) =>
        Text({
          key: `s${li}-${si}`,
          color: rendererColor(seg.fg),
          backgroundColor: rendererBg(seg.bg),
          children: seg.text,
        })
      ),
    })
  );
  return Box({ flexDirection: 'column', children: lines });
}
