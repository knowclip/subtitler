import {
  msToPixels,
  msToSeconds,
  pixelsToMs,
  secondsToMs,
  secondsToPixels,
  SELECTION_BORDER_MILLISECONDS,
  setCursorX,
  WAVEFORM_HEIGHT,
} from "../utils/waveform";
import { WAVEFORM_SEGMENT_SECONDS } from "../utils/useWaveformImages";
import { WaveformAction, WaveformInterface } from "../utils/useWaveform";
import {
  EventHandler,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import WaveformMousedownEvent, {
  WaveformDragAction,
  WaveformDragEvent,
} from "../utils/WaveformEvent";
import { WaveformSelection, WaveformState } from "../utils/WaveformState";

export default function Waveform({
  waveform,
  durationSeconds,
  imageUrls,
  playerRef,
}: {
  waveform: WaveformInterface;
  durationSeconds: number;
  imageUrls: string[];
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
}) {
  const height = WAVEFORM_HEIGHT; // + subtitles.totalTracksCount * SUBTITLES_CHUNK_HEIGHT

  const { viewBoxStartMs, pixelsPerSecond } = waveform.state;
  const { handleMouseDown, pendingActionRef } = useWaveformMouseActions(
    waveform.svgRef,
    waveform.state,
    playerRef,
    waveform.dispatch
  );

  return (
    <svg
      ref={waveform.svgRef}
      viewBox={getViewBoxString(msToPixels(viewBoxStartMs, pixelsPerSecond), WAVEFORM_HEIGHT)}
      height={height}
      style={{ background: "gray", alignSelf: "flex-start", width: '100%' }}
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
              // style={{ pointerEvents: "none" }}
              x={secondsToPixels(startSeconds, pixelsPerSecond)}
              preserveAspectRatio="none"
              width={secondsToPixels(
                endSeconds - startSeconds,
                pixelsPerSecond
              )}
              height={WAVEFORM_HEIGHT}
            />
          );
        })}
      </g>
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

function useWaveformMouseActions(
  svgRef: React.RefObject<SVGSVGElement>,
  state: WaveformState,
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>,
  dispatch: (action: WaveformAction) => void
) {
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
        if (!pendingAction) setCursorX(msToPixels(newTime, pixelsPerSecond));
      }
      if (pendingAction) {
        const finalAction = {
          ...pendingAction,
          end: ms,
          waveformState: state,
        };
        document.dispatchEvent(new WaveformDragEvent(finalAction));
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
  waveformSelection: WaveformSelection | null,
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
