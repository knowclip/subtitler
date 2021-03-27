import { MouseEvent } from "react";
import { msToSeconds } from "./utils";
import { WaveformState } from "./WaveformState";

if (!process.browser) (global as any).Event = Object

export default class WaveformMousedownEvent extends Event {
  milliseconds: number;
  browserMousedown: MouseEvent<SVGElement>;
  svg: SVGElement;

  constructor(browserMousedown: MouseEvent<SVGElement>, milliseconds: number) {
    super("waveformMousedown");
    this.browserMousedown = browserMousedown;
    this.svg = browserMousedown.currentTarget;
    this.milliseconds = milliseconds;
  }

  get seconds() {
    return msToSeconds(this.milliseconds);
  }
}

export class WaveformDragEvent extends Event {
  action: WaveformDragAction;

  constructor(action: WaveformDragAction) {
    super("waveformDrag");
    this.action = action;
  }
}

export type WaveformDragAction =
  | WaveformDragCreate
  | WaveformDragMove
  | WaveformDragStretch;

export type WaveformDragCreate = {
  type: "CREATE";
  start: number;
  end: number;
  waveformState: WaveformState;
};
export type WaveformDragMove = {
  type: "MOVE";
  start: number;
  end: number;
  clipToMove: { id: string; start: number; end: number };
  waveformState: WaveformState;
};
export type WaveformDragStretch = {
  type: "STRETCH";
  start: number;
  end: number;
  clipToStretch: { id: string; start: number; end: number };
  waveformState: WaveformState;
};
