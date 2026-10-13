import type { ColorIndex } from './colors.js';

export type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
export interface Segment {
  text: string;
  fg?: ColorIndex;
  bg?: ColorIndex;
  kind: SegmentKind;
}
export interface RenderLine {
  segments: Segment[];
}
export interface RenderModel {
  lines: RenderLine[];
}
