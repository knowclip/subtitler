import {
  msToPixels,
  msToSeconds,
  pixelsToMs,
  secondsToMs,
  secondsToPixels,
  SELECTION_BORDER_MILLISECONDS,
  setCursorX,
  WAVEFORM_HEIGHT,
} from "./utils";
import { WAVEFORM_SEGMENT_SECONDS } from "./useWaveformImages";
import { WaveformAction, WaveformInterface } from "./useWaveform";
import {
  EventHandler,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import WaveformMousedownEvent, {
  WaveformDragAction,
  WaveformDragCreate,
  WaveformDragEvent,
  WaveformDragMove,
  WaveformDragStretch,
} from "./WaveformEvent";
import { WaveformItem, WaveformState } from "./WaveformState";
import css from "./Waveform.module.scss";
import { getClipRectProps } from "./getClipRectProps";
import { Clips } from "./WaveformClips";

type WaveformEventHandlers = {
  onWaveformDrag: (action: WaveformDragCreate) => void;
  onClipDrag: (action: WaveformDragMove) => void;
  onClipEdgeDrag: (action: WaveformDragStretch) => void;
  onClipSelect?: (id: string) => void;
};

export default function Waveform({
  waveform,
  durationSeconds,
  imageUrls,
  playerRef,
  ...waveformEventHandlers
}: {
  waveform: WaveformInterface;
  durationSeconds: number;
  imageUrls: string[];
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
} & WaveformEventHandlers) {
  const height = WAVEFORM_HEIGHT; // + subtitles.totalTracksCount * SUBTITLES_CHUNK_HEIGHT

  const {
    viewBoxStartMs,
    pixelsPerSecond,
    pendingAction,
    selection,
  } = waveform.state;
  const { handleMouseDown, pendingActionRef } = useWaveformMouseActions({
    svgRef: waveform.svgRef,
    state: waveform.state,
    playerRef,
    dispatch: waveform.dispatch,
    ...waveformEventHandlers,
  });

  const highlightedClipId = selection?.type === "Clip" ? selection.id : null;
  const clips = useMemo(
    () => waveform.waveformItems.filter((item): item is WaveformItem  & {type: "Clip"} => item.type === "Clip"),
    [waveform.waveformItems]
  );

  return (
    <svg
      ref={waveform.svgRef}
      viewBox={getViewBoxString(
        msToPixels(viewBoxStartMs, pixelsPerSecond),
        WAVEFORM_HEIGHT
      )}
      height={height}
      style={{ background: "gray", alignSelf: "flex-start", width: "100%" }}
      preserveAspectRatio="xMinYMin slice"
      onMouseDown={handleMouseDown}
    >
      <g>
        <rect
          fill="#222222"
          x={0}
          y={0}
          width={secondsToPixels(durationSeconds, pixelsPerSecond)}
          height={height}
        />
        <Clips
          clips={clips}
          highlightedClipId={highlightedClipId}
          height={height}
          playerRef={playerRef}
          pixelsPerSecond={pixelsPerSecond}
        />
        {pendingAction && (
          <PendingWaveformItem
            action={pendingAction}
            height={height}
            rectRef={pendingActionRef}
            pixelsPerSecond={pixelsPerSecond}
          />
        )}
      </g>
      {imageUrls.map((url, i) => {
        const startSeconds = i * WAVEFORM_SEGMENT_SECONDS;
        const endSeconds = Math.min(
          (i + 1) * WAVEFORM_SEGMENT_SECONDS,
          durationSeconds
        );
        return (
          <image
            key={url}
            xlinkHref={url}
            style={{ pointerEvents: "none" }}
            x={secondsToPixels(startSeconds, pixelsPerSecond)}
            preserveAspectRatio="none"
            width={secondsToPixels(endSeconds - startSeconds, pixelsPerSecond)}
            height={WAVEFORM_HEIGHT}
          />
        );
      })}
      <Cursor x={2000} height={height} strokeWidth={1} />
    </svg>
  );
}

function getViewBoxString(xMin: number, height: number) {
  return `${xMin} 0 ${3000} ${height}`;
}

function Cursor({
  x,
  height,
  strokeWidth,
}: {
  x: number;
  height: number;
  strokeWidth: number;
}) {
  return (
    <line
      className="cursor"
      stroke="white"
      x1={x}
      y1="-1"
      x2={x}
      y2={height}
      shapeRendering="crispEdges"
      strokeWidth={strokeWidth}
      style={{ pointerEvents: "none" }}
    />
  );
}

const WAVEFORM_ACTION_TYPE_TO_CLASSNAMES: Record<
  WaveformDragAction["type"],
  string
> = {
  CREATE: css.waveformPendingClip,
  MOVE: css.waveformPendingClipMove,
  STRETCH: css.waveformPendingStretch,
};
function PendingWaveformItem({
  action,
  height,
  rectRef,
  pixelsPerSecond,
}: {
  action: WaveformDragAction;
  height: number;
  rectRef: MutableRefObject<SVGRectElement | null>;
  pixelsPerSecond: number;
}) {
  if (action.type === "MOVE") {
    const { start, end, clipToMove } = action;
    const deltaX = start - end;

    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(clipToMove.start - deltaX, pixelsPerSecond),
          msToPixels(clipToMove.end - deltaX, pixelsPerSecond),
          height
        )}
      />
    );
  }

  if (action.type === "STRETCH") {
    const { start, end, clipToStretch } = action;
    const originKey =
      Math.abs(start - clipToStretch.start) <
      Math.abs(start - clipToStretch.end)
        ? "start"
        : "end";
    const edge = clipToStretch[originKey];

    const deltaX = start - end;

    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(edge, pixelsPerSecond),
          msToPixels(edge - deltaX, pixelsPerSecond),
          height
        )}
      />
    );
  }
  return (
    <rect
      ref={rectRef}
      className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
      {...getClipRectProps(
        msToPixels(action.start, pixelsPerSecond),
        msToPixels(action.end, pixelsPerSecond),
        height
      )}
    />
  );
}
function useWaveformMouseActions({
  svgRef,
  state,
  playerRef,
  dispatch,
  onWaveformDrag,
}: {
  svgRef: React.RefObject<SVGSVGElement>;
  state: WaveformState;
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  dispatch: (action: WaveformAction) => void;
} & WaveformEventHandlers) {
  const { pendingAction, pixelsPerSecond, durationSeconds } = state;
  const pendingActionRef = useRef<SVGRectElement | null>(null);

  const mouseIsDown = useRef(false);

  const durationMilliseconds = secondsToMs(durationSeconds);

  useEffect(() => {
    const handleMouseMoves = (e: MouseEvent) => {
      if (!mouseIsDown.current) return;

      e.preventDefault();
      const svg = svgRef.current;
      if (svg) {
        const msAtMouse = waveformTimeAtMousePosition(
          e,
          svg,
          state.viewBoxStartMs,
          state.pixelsPerSecond
        );
        const ms = Math.min(durationMilliseconds, msAtMouse);
        dispatch({ type: "CONTINUE_WAVEFORM_MOUSE_ACTION", ms });
      }
    };
    document.addEventListener("mousemove", handleMouseMoves);
    return () => document.removeEventListener("mousemove", handleMouseMoves);
  }, [
    dispatch,
    svgRef,
    state.viewBoxStartMs,
    durationSeconds,
    durationMilliseconds,
    pixelsPerSecond,
  ]);

  const handleMouseDown: EventHandler<
    React.MouseEvent<SVGElement>
  > = useCallback(
    (e) => {
      e.preventDefault();
      const msAtMouse = waveformTimeAtMousePosition(
        e,
        e.currentTarget,
        state.viewBoxStartMs,
        pixelsPerSecond
      );
      const ms = Math.min(durationMilliseconds, msAtMouse);
      const waveformMousedown = new WaveformMousedownEvent(e, ms);
      document.dispatchEvent(waveformMousedown);
      const { dataset } = e.target as SVGGElement | SVGRectElement;

      const mousedownAction = getWaveformMousedownAction(dataset, ms, state);
      if (mousedownAction)
        dispatch({
          type: "START_WAVEFORM_MOUSE_ACTION",
          action: mousedownAction,
        });

      mouseIsDown.current = true;
    },
    [state, durationMilliseconds, pixelsPerSecond, dispatch]
  );

  useEffect(() => {
    const handleMouseUps = (e: MouseEvent) => {
      if (!mouseIsDown.current) return;
      mouseIsDown.current = false;
      dispatch({
        type: "START_WAVEFORM_MOUSE_ACTION" as const,
        action: null,
      });

      const svg = svgRef.current;
      if (!svg) return;

      const msAtMouse = waveformTimeAtMousePosition(
        e,
        svg,
        state.viewBoxStartMs,
        pixelsPerSecond
      );
      const ms = Math.min(durationMilliseconds, msAtMouse);
      const { dataset } = e.target as SVGGElement | SVGRectElement;

      if (playerRef.current) {
        const newTime = getTimeAfterMouseUp(
          pendingAction,
          state.selection,
          dataset,
          ms
        );

        playerRef.current.currentTime = msToSeconds(newTime);
        // if (!pendingAction) setCursorX(msToPixels(newTime, pixelsPerSecond));
        setCursorX(msToPixels(newTime, pixelsPerSecond));
      }
      if (pendingAction) {
        const finalAction = {
          ...pendingAction,
          end: ms,
          waveformState: state,
        };
        document.dispatchEvent(new WaveformDragEvent(finalAction));
        if (finalAction.type === "CREATE") onWaveformDrag(finalAction);
      }
    };
    document.addEventListener("mouseup", handleMouseUps);
    return () => document.removeEventListener("mouseup", handleMouseUps);
  }, [
    dispatch,
    durationMilliseconds,
    pendingAction,
    pixelsPerSecond,
    playerRef,
    svgRef,
    state,
    durationSeconds,
  ]);

  return {
    handleMouseDown,
    pendingActionRef,
  };
}

function waveformTimeAtMousePosition(
  mouseEvent: React.MouseEvent<SVGElement> | MouseEvent,
  svgElement: SVGElement,

  viewBoxStartMs: number,
  pixelsPerSecond: number
) {
  const { clientX } = mouseEvent;
  const { left } = svgElement.getBoundingClientRect();

  const offsetX = clientX - left;
  return pixelsToMs(offsetX, pixelsPerSecond) + viewBoxStartMs;
}

function getWaveformMousedownAction(
  dataset: DOMStringMap,
  ms: number,
  waveform: WaveformState
) {
  if (
    dataset &&
    dataset.clipId &&
    (Math.abs(Number(dataset.clipStart) - ms) <=
      SELECTION_BORDER_MILLISECONDS ||
      Math.abs(Number(dataset.clipEnd) - ms) <= SELECTION_BORDER_MILLISECONDS)
  ) {
    return {
      type: "STRETCH" as const,
      start: ms,
      end: ms,
      clipToStretch: {
        id: dataset.clipId,
        start: Number(dataset.clipStart),
        end: Number(dataset.clipEnd),
      },
      waveformState: waveform,
    };
  } else if (dataset && dataset.clipId)
    return {
      type: "MOVE" as const,
      start: ms,
      end: ms,
      clipToMove: {
        id: dataset.clipId,
        start: Number(dataset.clipStart),
        end: Number(dataset.clipEnd),
      },
      waveformState: waveform,
    };
  else
    return {
      type: "CREATE" as const,
      start: ms,
      end: ms,
      waveformState: waveform,
    };
}

function getTimeAfterMouseUp(
  pendingAction: WaveformDragAction | null,
  waveformSelection: WaveformItem | null,
  dataset: DOMStringMap,
  mouseMilliseconds: number
) {
  const clipIsToBeNewlySelected =
    dataset.clipId &&
    (waveformSelection?.type !== "Clip" ||
      waveformSelection.id !== dataset.clipId);
  if (clipIsToBeNewlySelected) {
    return Number(dataset.clipStart);
  }

  const itemAtMouse = Boolean(
    dataset &&
      ((dataset.clipId && !dataset.clipIsHighlighted) || dataset.chunkIndex)
  );

  return !pendingAction && itemAtMouse
    ? Number(dataset.clipStart || dataset.chunkStart)
    : mouseMilliseconds;
}
