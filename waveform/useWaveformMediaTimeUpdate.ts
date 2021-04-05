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
  selectionDoesntNeedSetAtNextTimeUpdate: MutableRefObject<boolean>,
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
      const wasSeeking = seeking.current;
      seeking.current = false;

      const svg = svgRef.current;
      if (!svg) return console.error("Svg disappeared");

      const newMilliseconds = secondsToMs(media.currentTime);
      const currentSelection = state.selection;

      if (selectionDoesntNeedSetAtNextTimeUpdate.current) {
        selectionDoesntNeedSetAtNextTimeUpdate.current = false;
        setCursorX(msToPixels(newMilliseconds, state.pixelsPerSecond));

        return;
      }

      const loopImminent =
        !wasSeeking &&
        looping &&
        !media.paused &&
        currentSelection?.item &&
        newMilliseconds >= currentSelection.item.end;
      console.log({
        loopImminent,
        currentSelection: currentSelection?.item.id,
      });
      if (loopImminent && currentSelection) {
        media.currentTime = msToSeconds(currentSelection.item.start);
        return dispatch({
          type: "NAVIGATE_TO_TIME",
          ms: currentSelection.item.start,
          viewBoxStartMs: state.viewBoxStartMs,
          selection: currentSelection,
        });
      }

      const newSelectionCandidate = getNewWaveformSelectionAt(
        waveformItems,
        regions,
        newMilliseconds,
        currentSelection
      );

      const newSelection = isValidNewSelection(
        currentSelection ? currentSelection.item : null,
        newSelectionCandidate ? newSelectionCandidate.item : null
      )
        ? newSelectionCandidate
        : null;

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
    [
      svgRef,
      state,
      selectionDoesntNeedSetAtNextTimeUpdate,
      waveformItems,
      regions,
      dispatch,
    ]
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
  newSelection: ReturnType<typeof getNewWaveformSelectionAt>,
  seeking: boolean
): number {
  const newSelectionItem = newSelection?.item || null;
  if (state.pendingAction) return state.viewBoxStartMs;
  const visibleTimeSpan = pixelsToMs(svgWidth, state.pixelsPerSecond);
  const buffer = Math.round(visibleTimeSpan * 0.1);

  const { viewBoxStartMs, durationSeconds } = state;
  const durationMs = secondsToMs(durationSeconds);
  const currentRightEdge = viewBoxStartMs + visibleTimeSpan;

  if (seeking && newSelectionItem) {
    if (newSelectionItem.end + buffer >= currentRightEdge)
      return bound(newSelectionItem.end + buffer - visibleTimeSpan, [
        0,
        durationMs - visibleTimeSpan,
      ]);

    if (newSelectionItem.start - buffer <= viewBoxStartMs)
      return Math.max(0, newSelectionItem.start - buffer);
  }

  const leftShiftRequired = newlySetMs < viewBoxStartMs;
  if (leftShiftRequired) {
    return Math.max(0, newlySetMs - buffer);
  }

  const rightShiftRequired = newlySetMs >= currentRightEdge;
  if (rightShiftRequired) {
    return bound(
      (newSelectionItem ? newSelectionItem.end : newlySetMs) + buffer,
      [0, durationMs - visibleTimeSpan]
    );
  }

  return state.viewBoxStartMs;
}

export const getNewWaveformSelectionAt = (
  newWaveformItems: Record<string, WaveformItem>,
  regions: WaveformRegion[],
  newMs: number,
  currentSelection: WaveformState["selection"]
): WaveformState["selection"] => {
  // TODO: optimize for non-seeking (normal playback) case
  const unchangedCurrentItem =
    currentSelection &&
    currentSelection.item === newWaveformItems[currentSelection.item.id]
      ? currentSelection.item
      : null;
  const stillWithinSameItem =
    unchangedCurrentItem &&
    newMs >= unchangedCurrentItem.start &&
    newMs < unchangedCurrentItem.end;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    if (region.start > newMs) break;

    if (newMs >= region.start && newMs < getRegionEnd(regions, i)) {
      const overlappedItemId =
        unchangedCurrentItem && stillWithinSameItem
          ? unchangedCurrentItem.id
          : region.itemIds.find(
              (id) =>
                newMs >= newWaveformItems[id].start &&
                newMs < newWaveformItems[id].end
            );
      const overlappedItem = overlappedItemId
        ? newWaveformItems[overlappedItemId]
        : null;
      return overlappedItem
        ? {
            region,
            item: overlappedItem,
            regionIndex: i,
          }
        : null;
    }
  }

  return null;
};
