import {
  msToPixels,
  pixelsToMs,
  secondsToMs,
  secondsToPixels,
  SELECTION_BORDER_MILLISECONDS,
  WAVEFORM_HEIGHT,
} from "./utils";
import { WAVEFORM_SEGMENT_SECONDS } from "./useWaveformImages";
import { WaveformInterface } from "./useWaveform";
import {
  EventHandler,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import WaveformMousedownEvent, {
  WaveformDragAction,
  WaveformDragCreate,
  WaveformDragEvent,
  WaveformDragMove,
  WaveformDragOf,
  WaveformDragStretch,
} from "./WaveformEvent";
import { WaveformItem, WaveformState } from "./WaveformState";
import css from "./Waveform.module.scss";
import { getClipRectProps } from "./getClipRectProps";
import { Clips } from "./WaveformClips";
import { WaveformRegion } from "../utils/calculateRegions";

type WaveformEventHandlers = {
  onWaveformDrag: (event: WaveformDragOf<WaveformDragCreate>) => void;
  onClipDrag: (event: WaveformDragOf<WaveformDragMove>) => void;
  onClipEdgeDrag: (event: WaveformDragOf<WaveformDragStretch>) => void;
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
  selectItem: (region: WaveformRegion, clip: WaveformItem) => void;
} & WaveformEventHandlers) {
  const height = WAVEFORM_HEIGHT; // + subtitles.totalTracksCount * SUBTITLES_CHUNK_HEIGHT

  const {
    viewBoxStartMs,
    pixelsPerSecond,
    pendingAction,
    selection,
  } = waveform.state;
  const { handleMouseDown, pendingActionRef } = useWaveformMouseActions({
    waveform,
    playerRef,
    ...waveformEventHandlers,
  });

  const highlightedClipId =
    selection?.item?.type === "Clip" ? selection.item.id : null;

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
          waveformItems={waveform.items}
          regions={waveform.regions}
          highlightedClipId={highlightedClipId}
          height={height}
          state={waveform.state}
        />
        {pendingAction && (
          <PendingWaveformItem
            action={pendingAction}
            height={height}
            rectRef={pendingActionRef}
            pixelsPerSecond={pixelsPerSecond}
            waveformItems={waveform.items}
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
  waveformItems,
}: {
  action: WaveformDragAction;
  height: number;
  rectRef: MutableRefObject<SVGRectElement | null>;
  pixelsPerSecond: number;
  waveformItems: Record<string, WaveformItem>;
}) {
  if (action.type === "MOVE") {
    const { start, end, clipId } = action;
    const deltaX = start - end;

    const clipToMove = waveformItems[clipId];
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
    const { start, end, clipId } = action;
    const clipToStretch = waveformItems[clipId];
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
  waveform,
  playerRef,
  ...eventHandlers
}: {
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  waveform: WaveformInterface;
} & WaveformEventHandlers) {
  const { svgRef, state, dispatch } = waveform;
  const { pendingAction, pixelsPerSecond, durationSeconds } = state;
  const pendingActionRef = useRef<SVGRectElement | null>(null);

  const mouseDown = useRef<WaveformMousedownEvent 
  | null>(null);

  const durationMilliseconds = secondsToMs(durationSeconds);

  useEffect(() => {
    const handleMouseMoves = (e: MouseEvent) => {
      if (!mouseDown.current) return;

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
    state.pixelsPerSecond,
  ]);

  const handleMouseDown: EventHandler<
    React.MouseEvent<SVGElement>
  > = useCallback(
    (e) => {
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

      const mousedownAction = getWaveformMousedownAction(
        dataset,
        waveformMousedown,
        state
      );
      if (mousedownAction)
        dispatch({
          type: "START_WAVEFORM_MOUSE_ACTION",
          action: mousedownAction,
        });

      mouseDown.current = waveformMousedown;
    },
    [state, durationMilliseconds, pixelsPerSecond, dispatch]
  );

  useEffect(() => {
    const handleMouseUps = (e: MouseEvent) => {
      if (!mouseDown.current) return;
      const currentMouseDown = mouseDown.current

      mouseDown.current = null;
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
      
      if (pendingAction) {
        const event = new WaveformDragEvent(
          currentMouseDown,
          {
          ...pendingAction,
          end: ms,
          waveformState: state,
        });
        document.dispatchEvent(event);

        if (event.action.type === ("CREATE" as const))
          eventHandlers.onWaveformDrag(
            event as WaveformDragOf<WaveformDragCreate>
          );
        if (event.action.type === "MOVE")
          eventHandlers.onClipDrag(event as WaveformDragOf<WaveformDragMove>);
        if (event.action.type === "STRETCH")
          eventHandlers.onClipEdgeDrag(
            event as WaveformDragOf<WaveformDragStretch>
          );
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
    eventHandlers,
    waveform.items,
    waveform.regions,
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
  event: WaveformMousedownEvent,
  waveform: WaveformState
): WaveformDragAction {
  const ms = event.milliseconds;
  const timeStamp = event.timeStamp;
  
  if (
    dataset &&
    dataset.clipId &&
    (Math.abs(Number(dataset.clipStart) - ms) <=
      SELECTION_BORDER_MILLISECONDS ||
      Math.abs(Number(dataset.clipEnd) - ms) <= SELECTION_BORDER_MILLISECONDS)
  ) {
    return {
      type: "STRETCH",
      start: ms,
      end: ms,
      regionIndex: Number(dataset.regionIndex),
      clipId: dataset.clipId,
      waveformState: waveform,
      timeStamp,
    };
  } else if (dataset && dataset.clipId)
    return {
      type: "MOVE",
      start: ms,
      end: ms,
      clipId: dataset.clipId,
      regionIndex: Number(dataset.regionIndex),
      waveformState: waveform,
      timeStamp,
    };
  else
    return {
      type: "CREATE",
      start: ms,
      end: ms,
      waveformState: waveform,
      timeStamp,
    };
}
