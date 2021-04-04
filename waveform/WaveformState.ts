import { WaveformRegion } from "../utils/calculateRegions";

export type WaveformState = {
  durationSeconds: number;
  cursorMs: number;
  viewBoxStartMs: number;
  pixelsPerSecond: number;
  selection: { regionIndex: number, region: WaveformRegion, item: WaveformItem } | null;
  pendingAction: import("./WaveformEvent").WaveformDragAction | null;
};

export type WaveformItem = Clip | {
  type: "Preview";
  id: string;
  start: number;
  end: number;
};

export type Clip = { type: "Clip", id: string; start: number; end: number };
type SubtitlesCardBase = any;
