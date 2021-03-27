export type WaveformState = {
  durationSeconds: number;
  cursorMs: number;
  viewBoxStartMs: number;
  pixelsPerSecond: number;
  selection: WaveformSelection | null;
  pendingAction: import("./WaveformEvent").WaveformDragAction | null;
};

export type WaveformSelection =
  | { type: "Clip"; index: number; id: string }
  | { type: "Preview"; index: number; cardBaseIndex: number };

export type WaveformSelectionExpanded =
  | { type: "Clip"; index: number; item: Clip; id: string }
  | {
      type: "Preview";
      index: number;
      item: SubtitlesCardBase;
      cardBaseIndex: number;
    };

export type Clip = { id: string, start: number, end: number };
type SubtitlesCardBase = any;
