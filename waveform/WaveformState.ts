export type WaveformState = {
  durationSeconds: number;
  cursorMs: number;
  viewBoxStartMs: number;
  pixelsPerSecond: number;
  selection: WaveformItem | null;
  pendingAction: import("./WaveformEvent").WaveformDragAction | null;
};

export type WaveformItem =
  | { type: "Clip"; index: number; id: string, start: number, end: number }
  | { type: "Preview"; index: number; cardBaseIndex: number, start: number, end: number };

export type Clip = { id: string, start: number, end: number };
type SubtitlesCardBase = any;
