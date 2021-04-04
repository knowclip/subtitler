export type WaveformState = {
  durationSeconds: number;
  cursorMs: number;
  viewBoxStartMs: number;
  pixelsPerSecond: number;
  selection: WaveformItem | null;
  pendingAction: import("./WaveformEvent").WaveformDragAction | null;
};

export type WaveformItem = {
  type: "Clip" | "Preview";
  id: string;
  start: number;
  end: number;
};

export type Clip = { id: string; start: number; end: number };
type SubtitlesCardBase = any;
