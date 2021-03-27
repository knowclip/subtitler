import { secondsToPixels, WAVEFORM_HEIGHT } from "../utils/waveform";
import { WAVEFORM_SEGMENT_SECONDS } from "../utils/useWaveformImages";

export default function Waveform({
  durationSeconds,
  imageUrls,
}: {
  durationSeconds: number;
  imageUrls: string[];
}) {
  const pixelsPerSecond = 50;
  const height = WAVEFORM_HEIGHT; // + subtitles.totalTracksCount * SUBTITLES_CHUNK_HEIGHT

  return (
    <svg
      viewBox={getViewBoxString(0, WAVEFORM_HEIGHT)}
      height={height}
      style={{ background: "gray", alignSelf: "flex-start" }}
      preserveAspectRatio="xMinYMin slice"
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
