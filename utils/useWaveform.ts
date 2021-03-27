import { useCallback, useMemo, useReducer, useRef } from "react";
import { pixelsToMs, secondsToMs } from "../utils/waveform";
import { bound } from "./bound";

import { useWaveformMediaTimeUpdate } from "./useWaveformMediaTimeUpdate";
import { WaveformDragAction } from "./WaveformEvent";
import {
  WaveformSelection,
  WaveformSelectionExpanded,
  WaveformState,
} from "./WaveformState";

const initialState: WaveformState = {
  cursorMs: 0,
  durationSeconds: 0,
  viewBoxStartMs: 0,
  pixelsPerSecond: 50,
  selection: null,
  pendingAction: null,
};

export type WaveformInterface = ReturnType<typeof useWaveform>;

export function useWaveform(waveformItems: WaveformSelectionExpanded[]) {
  const limitWaveformItemsToDisplayed = limitSelectorToDisplayedItems(
    (waveformItem: WaveformSelectionExpanded) => waveformItem.item.start,
    (waveformItem: WaveformSelectionExpanded) => waveformItem.item.end
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const [state, dispatch] = useReducer(updateViewState, initialState);
  const resetWaveformState = useCallback(
    (media: HTMLVideoElement | HTMLAudioElement | null) => {
      dispatch({ type: "RESET", durationSeconds: media?.duration || 0 });
    },
    [dispatch]
  );

  const visibleWaveformItems = useMemo(
    () =>
      limitWaveformItemsToDisplayed(
        waveformItems,
        state.viewBoxStartMs,
        state.pixelsPerSecond
      ),
    [
      limitWaveformItemsToDisplayed,
      waveformItems,
      state.viewBoxStartMs,
      state.pixelsPerSecond,
    ]
  );

  const waveformInterface = {
    svgRef,
    state,
    dispatch,
    resetWaveformState,
    visibleWaveformItems,
    waveformItems,
  };

  return {
    onTimeUpdate: useWaveformMediaTimeUpdate(
      svgRef,
      dispatch,
      visibleWaveformItems,
      waveformItems,
      state
    ),
    ...waveformInterface,
  };
}

export type SetWaveformCursorPosition = {
  type: "NAVIGATE_TO_TIME";
  ms: number;
  viewBoxStartMs?: number;
  selection?: WaveformSelection | null;
};
export type WaveformAction =
  | SetWaveformCursorPosition
  | { type: "START_WAVEFORM_MOUSE_ACTION"; action: WaveformDragAction | null }
  | { type: "CONTINUE_WAVEFORM_MOUSE_ACTION"; ms: number }
  | { type: "CLEAR_WAVEFORM_MOUSE_ACTION" }
  | { type: "RESET"; durationSeconds: number }
  | { type: "ZOOM"; delta: number; svgWidth: number };

function updateViewState(
  state: WaveformState,
  action: WaveformAction
): WaveformState {
  switch (action.type) {
    case "RESET":
      return { ...initialState, durationSeconds: action.durationSeconds };
    case "START_WAVEFORM_MOUSE_ACTION":
      return {
        ...state,
        pendingAction: action.action,
      };
    case "CONTINUE_WAVEFORM_MOUSE_ACTION":
      return {
        ...state,
        pendingAction: state.pendingAction
          ? {
              ...state.pendingAction,
              end: action.ms,
            }
          : null,
      };
    case "NAVIGATE_TO_TIME": {
      const { ms, viewBoxStartMs, selection } = action;
      return {
        ...state,
        cursorMs: ms,
        viewBoxStartMs:
          typeof viewBoxStartMs === "number"
            ? viewBoxStartMs
            : state.viewBoxStartMs,
        selection:
          typeof selection !== "undefined" ? selection : state.selection,
      };
    }
    case "ZOOM": {
      const newPixelsPerSecond = bound(state.pixelsPerSecond + action.delta, [
        10,
        200,
      ]);
      const oldVisibleTimeSpan = pixelsToMs(
        action.svgWidth,
        state.pixelsPerSecond
      );
      const cursorScreenOffset = state.cursorMs - state.viewBoxStartMs;
      const cursorScreenOffsetRatio = cursorScreenOffset / oldVisibleTimeSpan;
      const newVisibleTimeSpan = pixelsToMs(
        action.svgWidth,
        newPixelsPerSecond
      );
      const newCursorScreenOffset = Math.round(
        cursorScreenOffsetRatio * newVisibleTimeSpan
      );
      const potentialNewViewBoxStartMs = state.cursorMs - newCursorScreenOffset;
      return {
        ...state,
        pixelsPerSecond: newPixelsPerSecond,
        viewBoxStartMs: bound(potentialNewViewBoxStartMs, [
          0,
          secondsToMs(state.durationSeconds) - newVisibleTimeSpan,
        ]),
      };
    }
    default:
      return state;
  }
}

const MAX_WAVEFORM_VIEWPORT_WIDTH = 3000;

export const limitSelectorToDisplayedItems = <T>(
  getStart: (item: T) => number,
  getEnd: (item: T) => number
) => (
  waveformItems: T[],
  waveformviewBoxStartMs: number,
  pixelsPerSecond: number
) => {
  const result: T[] = [];
  const xMax =
    waveformviewBoxStartMs +
    pixelsToMs(MAX_WAVEFORM_VIEWPORT_WIDTH, pixelsPerSecond);
  for (const waveformItem of waveformItems) {
    const itemStart = getStart(waveformItem);
    if (itemStart > xMax) break;

    const itemEnd = getEnd(waveformItem);
    // TODO: speed this up with binary search maybe?

    const overlap = itemStart <= xMax && itemEnd >= waveformviewBoxStartMs;
    if (overlap) result.push(waveformItem);
  }
  return result;
};
