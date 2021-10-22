import React, { useCallback } from "react";
import {
  WaveformItem,
  WaveformGesture,
  ClipDrag,
  WaveformGestureOf,
  ClipStretch,
  CLIP_THRESHOLD_MILLSECONDS,
  msToSeconds,
  secondsToMs,
  WaveformInterface,
} from "clipwave";
import { getCaptionArticleId } from "../utils/getCaptionArticleId";
import { bound } from "../utils/bound";
import { newId } from "../utils/newId";
import { DRAG_ACTION_TIME_THRESHOLD } from "./HomeEditor";
import { Action } from "./editorReducer";

export function useWaveformEventHandlers(
  waveform: WaveformInterface,
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>,
  dispatch: React.Dispatch<Action>,
  highlightedClipId: string | null,
  waveformItems: Record<string, WaveformItem>
) {
  const {
    actions: waveformActions,
    getItem,
    state: { regions },
  } = waveform;
  const { selectItem } = waveformActions;

  const handleWaveformDrag = useCallback(
    ({
      gesture: { start: startRaw, end: endRaw },
    }: WaveformGestureOf<WaveformGesture>) => {
      const start = Math.min(startRaw, endRaw);
      const end = Math.max(startRaw, endRaw);

      if (end - start < CLIP_THRESHOLD_MILLSECONDS) {
        if (playerRef.current) {
          playerRef.current.currentTime = msToSeconds(startRaw);
        }
        return;
      }

      const id = newId();
      const newClip = {
        clipwaveType: "Primary" as const,
        start,
        end,
        id,
      };
      dispatch({
        type: "ADD_ITEM",
        item: newClip,
      });
      waveformActions.addItem(newClip);

      if (playerRef.current) {
        playerRef.current.currentTime = msToSeconds(start);
      }

      setTimeout(() => {
        const button: HTMLTextAreaElement | null = document.querySelector(
          `#${getCaptionArticleId(id)} button`
        );
        button?.click();
      }, 0);
    },
    [dispatch, playerRef, waveformActions]
  );
  const handleClipDrag = useCallback(
    ({ gesture: move, mouseDown, timeStamp }: WaveformGestureOf<ClipDrag>) => {
      const { start, end, clipId, regionIndex } = move;
      const isPrimaryClip = getItem(clipId)?.clipwaveType === "Primary";
      if (!isPrimaryClip) {
        // select
        return;
      }

      const deltaX = end - start;
      const moveImminent =
        timeStamp - mouseDown.timeStamp > DRAG_ACTION_TIME_THRESHOLD;

      if (moveImminent) {
        waveformActions.moveItem(move);

        dispatch({
          type: "MOVE_ITEM",
          id: clipId,
          deltaX,
        });
      }

      // dangerous
      const draggedClip = getItem(clipId)!;
      const isHighlighted = draggedClip.id === highlightedClipId;
      const region = regions[regionIndex];
      if (!isHighlighted) selectItem(regionIndex, draggedClip.id);

      if (playerRef.current) {
        const clipStart = moveImminent
          ? draggedClip.start + deltaX
          : draggedClip.start;
        const newTimeSeconds =
          !isHighlighted || moveImminent
            ? bound(msToSeconds(clipStart), [0, waveform.state.durationSeconds])
            : msToSeconds(end);

        waveform.actions.selectItemAndSeekTo(
          regionIndex,
          draggedClip.id,
          playerRef.current,
          secondsToMs(newTimeSeconds)
        );
      }
    },
    [
      getItem,
      highlightedClipId,
      regions,
      selectItem,
      playerRef,
      waveformActions,
      dispatch,
      waveform.state.durationSeconds,
      waveform.actions,
    ]
  );
  const handleClipEdgeDrag = useCallback(
    ({
      gesture: stretch,
      timeStamp,
      mouseDown,
    }: WaveformGestureOf<ClipStretch>) => {
      const { start, end, clipId, regionIndex, originKey } = stretch;

      const draggedClip = waveformItems[clipId];

      const stretchImminent =
        timeStamp - mouseDown.timeStamp > DRAG_ACTION_TIME_THRESHOLD;

      const isHighlighted = draggedClip.id === highlightedClipId;
      if (!isHighlighted) selectItem(regionIndex, draggedClip.id);

      if (stretchImminent) {
        waveformActions.stretchItem(stretch);

        dispatch({
          type: "STRETCH_ITEM",
          id: clipId,
          originKey,
          start,
          end,
        });
      }

      if (playerRef.current) {
        const clipStart = draggedClip.start;
        const newTimeSeconds =
          !isHighlighted || stretchImminent
            ? bound(msToSeconds(clipStart), [0, waveform.state.durationSeconds])
            : msToSeconds(end);

        waveform.actions.selectItemAndSeekTo(
          regionIndex,
          draggedClip.id,
          playerRef.current,
          secondsToMs(newTimeSeconds)
        );
      }
    },
    [
      waveformItems,
      highlightedClipId,
      selectItem,
      playerRef,
      waveformActions,
      dispatch,
      waveform.state.durationSeconds,
      waveform.actions,
    ]
  );
  return { handleWaveformDrag, handleClipDrag, handleClipEdgeDrag };
}
