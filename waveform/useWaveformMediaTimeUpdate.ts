import { useCallback, MutableRefObject, Dispatch } from "react";
import { WaveformAction } from "./useWaveform";
import {
  secondsToMs,
  msToSeconds,
  pixelsToMs,
  setCursorX,
  msToPixels,
} from "./utils";
import { WaveformItem, WaveformState } from "./WaveformState";
import { bound } from "../utils/bound";
import { elementWidth } from "../utils/elementWidth";
import { getRegionEnd, WaveformRegion } from "../utils/calculateRegions";

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
  waveformItems: Record<string, WaveformItem>,
  regions: WaveformRegion[],
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
      const expandedSelection: WaveformItem | null = currentSelection
        ? ({
            type: currentSelection.type,
            // index: currentSelection.index,

            // TODO: accommodate other types
            start: currentSelection.start,
            end: currentSelection.end,
            id: currentSelection.id,
          } as WaveformItem)
        : null;

      const newSelectionCandidate = getNewWaveformSelectionAtFromSubset(
        expandedSelection,
        waveformItems,
        regions,
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
        newMilliseconds >= currentSelection.end;
      if (loopImminent && currentSelection && currentSelection) {
        media.currentTime = msToSeconds(currentSelection.start);
        const action: WaveformAction = {
          type: "NAVIGATE_TO_TIME",
          ms: currentSelection.start,
          viewBoxStartMs: state.viewBoxStartMs,
        };
        return dispatch(action);
      }

      const svgWidth = elementWidth(svg);

      setCursorX(msToPixels(newMilliseconds, state.pixelsPerSecond));
      dispatch({
        type: "NAVIGATE_TO_TIME",
        ms: newMilliseconds,
        selection:
          !wasSeeking && !newSelection ? currentSelection : newSelection,
        viewBoxStartMs: viewBoxStartMsOnTimeUpdate(
          state,
          newMilliseconds,
          svgWidth,
          newSelection,
          wasSeeking
        ),
      });
    },
    [svgRef, state, waveformItems, regions, dispatch]
  );
}

function isValidNewSelection(
  currentSelection: WaveformItem | null,
  newSelectionCandidate: WaveformItem | null
) {
  if (
    currentSelection &&
    currentSelection.type === "Clip" &&
    newSelectionCandidate &&
    newSelectionCandidate.type === "Preview"
  ) {
    return overlapsSignificantly(
      newSelectionCandidate,
      currentSelection.start,
      currentSelection.end
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

  if (seeking && newSelection) {
    if (newSelection.end + buffer >= currentRightEdge)
      return bound(newSelection.end + buffer - visibleTimeSpan, [
        0,
        durationMs - visibleTimeSpan,
      ]);

    if (newSelection.start - buffer <= viewBoxStartMs)
      return Math.max(0, newSelection.start - buffer);
  }

  const leftShiftRequired = newlySetMs < viewBoxStartMs;
  if (leftShiftRequired) {
    return Math.max(0, newlySetMs - buffer);
  }

  const rightShiftRequired = newlySetMs >= currentRightEdge;
  if (rightShiftRequired) {
    return bound((newSelection ? newSelection.end : newlySetMs) + buffer, [
      0,
      durationMs - visibleTimeSpan,
    ]);
  }

  return state.viewBoxStartMs;
}

export const getNewWaveformSelectionAtFromSubset = (
  currentSelection: WaveformItem | null,
  newWaveformItems: Record<string, WaveformItem>,
  regions: WaveformRegion[],
  newMs: number
): WaveformItem | null => {
  const itemAtCurrentSelectionPosition = currentSelection;
  const itemIsSameAsOldSelection =
    currentSelection &&
    itemAtCurrentSelectionPosition &&
    isItemSameAsOldSelection(currentSelection, itemAtCurrentSelectionPosition);
  if (
    itemIsSameAsOldSelection &&
    itemAtCurrentSelectionPosition &&
    newMs >= itemAtCurrentSelectionPosition.start &&
    newMs <= itemAtCurrentSelectionPosition.end
  )
    return itemAtCurrentSelectionPosition;

  const overlappingSet = new Set<WaveformItem>();
  const overlapping: WaveformItem[] = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    if (region.start > newMs) break;

    if (newMs >= region.start && newMs <= getRegionEnd(regions, i))
      region.itemIds.forEach((id) => {
        const item = newWaveformItems[id];
        if (newMs >= item.start && newMs <= item.end) {
          const sizeBefore = overlappingSet.size;
          overlappingSet.add(item);
          if (sizeBefore !== overlappingSet.size) overlapping.push(item);
        }
      });
  }

  if (overlapping.length <= 1) return overlapping[0] || null;

  return overlapping.find(({ type }) => type === "Clip") || null;
};

const isItemSameAsOldSelection = (
  oldCurrentSelection: WaveformItem,
  itemAtCurrentSelectionPosition: WaveformItem
) => {
  if (oldCurrentSelection.type !== itemAtCurrentSelectionPosition.type)
    return false;
  if (
    oldCurrentSelection.id ===
    (itemAtCurrentSelectionPosition as typeof oldCurrentSelection).id
  )
    return true;

  return false;
};
