export type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex';
export interface Segment {
  text: string;
  fg?: string;
  bg?: string;
  kind: SegmentKind;
}
export interface RenderLine {
  segments: Segment[];
}
export interface RenderModel {
  lines: RenderLine[];
}
