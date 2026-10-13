export { render } from './render.js';
export type { RenderOptions } from './render.js';
export { toAnsi } from './ansi.js';
export { loadConfig } from './config/validate.js';
export { LINKABLE, linkedSurfaces, writeLinkedLines } from './config/links.js';
export type { LinkableSurface } from './config/links.js';
export { defaultConfig } from './config/defaults.js';
export { importCcstatusline } from './config/import-ccstatusline.js';
export { register, registry } from './widgets/registry.js';
export { asIndex, isColorIndex } from './colors.js';
export type { ColorIndex } from './colors.js';
export { indexToHex, indexToRgb } from './theme/xterm256.js';
export { evalWhen, isValidWhen, TOAST_FIELDS } from './toast.js';

export type { Snapshot } from './snapshot.js';
export type { RenderLine, RenderModel, Segment, SegmentKind } from './render-model.js';
export type {
  Align,
  Config,
  CustomCommandItem,
  CustomTextItem,
  DataItem,
  DataWidgetType,
  Defaults,
  FlexSeparatorItem,
  Item,
  ItemStyle,
  PaletteSlot,
  SeparatorMode,
  StylableItem,
  SurfaceLayout,
  Theme,
  ToastRule,
  ToastSurface,
  WidgetType,
} from './config/types.js';
export type { WidgetContext, WidgetDef } from './widgets/types.js';
export { builtinThemes } from './theme/themes.js';
export { rendererBg, rendererColor } from './renderer-colors.js';
