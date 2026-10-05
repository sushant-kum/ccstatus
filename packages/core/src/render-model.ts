export type SegmentKind = 'cell' | 'separator' | 'cap' | 'flex'
export type Segment = { text: string; fg?: string; bg?: string; kind: SegmentKind }
export type RenderLine = { segments: Segment[] }
export type RenderModel = { lines: RenderLine[] }
