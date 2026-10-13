export type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
export interface Segment {
  text: string;
  fg?: number;
  bg?: number;
  kind: SegmentKind;
}
export interface RenderLine {
  segments: Segment[];
}
export interface RenderModel {
  lines: RenderLine[];
}
