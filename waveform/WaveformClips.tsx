import React, { MutableRefObject, useCallback } from "react";
import cn from 'classnames'
import { getClipRectProps } from "./getClipRectProps";
import {
  msToSeconds,
  setCursorX,
  msToPixels,
  SELECTION_BORDER_MILLISECONDS,
} from "./utils";
import { Clip } from "./WaveformState";
import css from './Waveform.module.scss'

type ClipProps = {
  id: string;
  start: number;
  end: number;
  isHighlighted: boolean;
  height: number;
  index: number;
  pixelsPerSecond: number;
};
type ClipClickDataProps = {
  "data-clip-id": string;
  "data-clip-start": number;
  "data-clip-end": number;
  "data-clip-index": number;
  "data-clip-is-highlighted"?: number;
};

export const Clips = React.memo(
  ({
    clips,
    highlightedClipId,
    height,
    playerRef,
    pixelsPerSecond,
  }: {
    clips: Clip[];
    highlightedClipId: string | null;
    height: number;
    playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
    pixelsPerSecond: number;
  }) => {
    const handleClick = useCallback(
      (e) => {
        const { dataset } = e.target;
        if (dataset && dataset.clipId) {
          if (!dataset.clipIsHighlighted) {
            const player = playerRef.current;
            if (player)
              player.currentTime = msToSeconds(clips[dataset.clipIndex].start);
            setCursorX(
              msToPixels(clips[dataset.clipIndex].start, pixelsPerSecond)
            );
          }
          const currentSelected = document.querySelector(
            "." + css.highlightedClip
          );
          if (currentSelected)
            currentSelected.classList.remove(css.highlightedClip);
          const newSelected = document.querySelector(
            `.${css.waveformClip}[data-clip-id="${dataset.clipId}"]`
          );
          if (newSelected) newSelected.classList.add(css.highlightedClip);
        }
      },
      [clips, pixelsPerSecond, playerRef]
    );

    return (
      // className={$.waveformClipsContainer} 
      <g onClick={handleClick}>
        {clips.map((clip, i) => (
          <WaveformClip
            {...clip}
            index={i}
            key={clip.id}
            isHighlighted={clip.id === highlightedClipId}
            height={height}
            pixelsPerSecond={pixelsPerSecond}
          />
        ))}
      </g>
    );
  }
);

const WaveformClip = React.memo(
  ({
    id,
    start,
    end,
    isHighlighted,
    height,
    index,
    pixelsPerSecond,
  }: ClipProps) => {
    const clickDataProps: ClipClickDataProps = {
      "data-clip-id": id,
      "data-clip-start": start,
      "data-clip-end": end,
      "data-clip-index": index,
    };
    if (isHighlighted) clickDataProps["data-clip-is-highlighted"] = 1;

    return (
      <g id={id} {...clickDataProps}>
        <rect
          className={cn(
            css.waveformClip,
            { [css.highlightedClip]: isHighlighted },
            // $.waveformClip
          )}
          {...getClipRectProps(
            msToPixels(start, pixelsPerSecond),
            msToPixels(end, pixelsPerSecond),
            height
          )}
          {...clickDataProps}
        />

        <rect
          className={css.waveformClipBorder}
          x={msToPixels(start, pixelsPerSecond)}
          y="0"
          width={msToPixels(SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
          height={height}
          {...clickDataProps}
        />
        <rect
          className={cn(css.waveformClipBorder, {
            [css.highlightedClipBorder]: isHighlighted,
          })}
          x={msToPixels(end - SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
          y="0"
          width={msToPixels(SELECTION_BORDER_MILLISECONDS, pixelsPerSecond)}
          height={height}
          {...clickDataProps}
        />
      </g>
    );
  }
);
