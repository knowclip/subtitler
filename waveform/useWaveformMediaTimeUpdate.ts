import { useCallback, MutableRefObject, Dispatch } from "react";
import { WaveformAction } from "./useWaveform";
import { secondsToMs, msToSeconds, pixelsToMs } from "./utils";
import {
  WaveformSelection,
  WaveformSelectionExpanded,
  WaveformState,
} from "./WaveformState";
import { bound } from "../utils/bound";
import { elementWidth } from "../utils/elementWidth";

const HALF_SECOND = 500;
export const overlapsSignificantly = (
  chunk: { start: number; end: number },
  start: number,
  end: number
): boolean =>
  start <= chunk.end - HALF_SECOND && end >= chunk.start + HALF_SECOND;

export function useWaveformMediaTimeUpdate(
  svgRef: MutableRefObject<SVGElement | null>,
  dispatch: Dispatch<WaveformAction>,
  visibleWaveformItems: WaveformSelectionExpanded[],
  waveformItems: WaveformSelectionExpanded[],
  state: WaveformState
) {
  return useCallback(
    (
      media: HTMLVideoElement | HTMLAudioElement,
      seeking: MutableRefObject<boolean>,
      looping: boolean
    ) => {
      const svg = svgRef.current;
      if (!svg) return console.error("Svg disappeared");

      const newMilliseconds = secondsToMs(media.currentTime);
      const currentSelection = state.selection;
      const selectionItem = getSelectionWaveformItem(
        waveformItems,
        currentSelection
      );
      const expandedSelection: WaveformSelectionExpanded | null =
        currentSelection && selectionItem
          ? ({
              type: currentSelection.type,
              index: currentSelection.index,
              item: selectionItem,
            } as WaveformSelectionExpanded)
          : null;

      const newSelectionCandidate = getNewWaveformSelectionAtFromSubset(
        expandedSelection,
        waveformItems,
        newMilliseconds
      );

      const newSelection = isValidNewSelection(
        expandedSelection,
        newSelectionCandidate
      )
        ? newSelectionCandidate
        : null;
      const wasSeeking = seeking.current;
      seeking.current = false;

      const loopImminent =
        !wasSeeking &&
        looping &&
        !media.paused &&
        currentSelection &&
        selectionItem &&
        newMilliseconds >= selectionItem.end;
      if (loopImminent && currentSelection && selectionItem) {
        media.currentTime = msToSeconds(selectionItem.start);
        const action: WaveformAction = {
          type: "NAVIGATE_TO_TIME",
          ms: selectionItem.start,
          viewBoxStartMs: state.viewBoxStartMs,
        };
        return dispatch(action);
      }

      dispatch({
        type: "NAVIGATE_TO_TIME",
        ms: newMilliseconds,
        selection:
          !wasSeeking && !newSelection ? currentSelection : newSelection,
        viewBoxStartMs: viewBoxStartMsOnTimeUpdate(
          state,
          newMilliseconds,
          elementWidth(svg),
          newSelection,
          wasSeeking
        ),
      });
    },
    [dispatch, svgRef, state, waveformItems]
  );
}

function getSelectionWaveformItem(
  waveformItems: WaveformSelectionExpanded[],
  currentSelection: WaveformSelection | null
) {
  return currentSelection
    ? waveformItems[currentSelection.index]?.item || null
    : null;
}

function isValidNewSelection(
  currentSelection: WaveformSelectionExpanded | null,
  newSelectionCandidate: WaveformSelectionExpanded | null
) {
  if (
    currentSelection &&
    currentSelection.type === "Clip" &&
    newSelectionCandidate &&
    newSelectionCandidate.type === "Preview"
  ) {
    return overlapsSignificantly(
      newSelectionCandidate.item,
      currentSelection.item.start,
      currentSelection.item.end
    )
      ? false
      : true;
  }

  return true;
}

function viewBoxStartMsOnTimeUpdate(
  state: WaveformState,
  newlySetMs: number,
  svgWidth: number,
  newSelection: ReturnType<typeof getNewWaveformSelectionAtFromSubset>,
  seeking: boolean
): number {
  if (state.pendingAction) return state.viewBoxStartMs;

  const visibleTimeSpan = pixelsToMs(svgWidth, state.pixelsPerSecond);

  const buffer = Math.round(visibleTimeSpan * 0.1);

  const { viewBoxStartMs, durationSeconds } = state;
  const durationMs = secondsToMs(durationSeconds);

  const currentRightEdge = viewBoxStartMs + visibleTimeSpan;

  const leftShiftRequired = newlySetMs < viewBoxStartMs;
  if (leftShiftRequired) {
    return Math.max(0, newlySetMs - buffer);
  }

  const rightShiftRequired = newlySetMs >= currentRightEdge;
  if (rightShiftRequired) {
    return bound(newSelection ? newSelection.item.end + buffer : newlySetMs, [
      0,
      durationMs - visibleTimeSpan,
    ]);
  }

  if (seeking && newSelection) {
    if (newSelection.item.end + buffer >= currentRightEdge)
      return bound(newSelection.item.end + buffer - visibleTimeSpan, [
        0,
        durationMs - visibleTimeSpan,
      ]);

    if (newSelection.item.start - buffer <= viewBoxStartMs)
      return Math.max(0, newSelection.item.start - buffer);
  }

  return state.viewBoxStartMs;
}

export const getNewWaveformSelectionAtFromSubset = (
  currentSelection: WaveformSelection | null,
  newWaveformItems: WaveformSelectionExpanded[],
  newMs: number
): WaveformSelectionExpanded | null => {
  const itemAtCurrentSelectionPosition = currentSelection
    ? newWaveformItems[currentSelection.index]
    : null;
  const itemIsSameAsOldSelection =
    currentSelection &&
    itemAtCurrentSelectionPosition &&
    isItemSameAsOldSelection(currentSelection, itemAtCurrentSelectionPosition);
  if (
    itemIsSameAsOldSelection &&
    itemAtCurrentSelectionPosition &&
    newMs >= itemAtCurrentSelectionPosition.item.start &&
    newMs <= itemAtCurrentSelectionPosition.item.end
  )
    return itemAtCurrentSelectionPosition;

  const overlapping: WaveformSelectionExpanded[] = [];

  for (const clipOrPreview of newWaveformItems) {
    const { item } = clipOrPreview;
    if (item.start > newMs) break;

    if (newMs >= item.start && newMs <= item.end)
      overlapping.push(clipOrPreview);
  }

  if (overlapping.length <= 1) return overlapping[0] || null;

  return overlapping.find(({ type }) => type === "Clip") || null;
};

const isItemSameAsOldSelection = (
  oldCurrentSelection: WaveformSelection,
  itemAtCurrentSelectionPosition: WaveformSelection
) => {
  if (oldCurrentSelection.type !== itemAtCurrentSelectionPosition.type)
    return false;
  if (
    oldCurrentSelection.type === "Clip" &&
    oldCurrentSelection.id ===
      (itemAtCurrentSelectionPosition as typeof oldCurrentSelection).id
  )
    return true;
  if (
    oldCurrentSelection.type === "Preview" &&
    oldCurrentSelection.index ===
      (itemAtCurrentSelectionPosition as typeof oldCurrentSelection).index
  )
    return true;

  return false;
};
