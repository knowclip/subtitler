import React, { MutableRefObject, ReactNode, useCallback } from "react";
import cn from "classnames";
import { getClipRectProps } from "./getClipRectProps";
import { msToPixels, SELECTION_BORDER_MILLISECONDS } from "./utils";
import { Clip, WaveformItem } from "./WaveformState";
import css from "./Waveform.module.scss";
import { WaveformRegion } from "../utils/calculateRegions";

type ClipProps = {
  clip: Clip;
  region: WaveformRegion;
  regionIndex: number;
  isHighlighted: boolean;
  height: number;
  index: number;
  pixelsPerSecond: number;
  selectItem: (region: WaveformRegion, clip: WaveformItem) => void;
};
type ClipClickDataProps = {
  "data-clip-id": string;
  "data-clip-start": number;
  "data-clip-end": number;
  "data-clip-index": number;
  "data-clip-is-highlighted"?: number;
};

const ClipsBase = ({
  waveformItems,
  regions,
  highlightedClipId,
  height,
  playerRef,
  pixelsPerSecond,
  selectItem,
}: {
  waveformItems: Record<string, WaveformItem>;
  regions: WaveformRegion[];
  highlightedClipId: string | null;
  height: number;
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  pixelsPerSecond: number;
  selectItem: (region: WaveformRegion, clip: WaveformItem) => void;
}) => {
  let highlightedClipDisplay: ReactNode;

  return (
    // className={$.waveformClipsContainer}
    <g>
      {regions.flatMap((region, i) => {
        return region.itemIds.flatMap((id) => {
          const clip = waveformItems[id];
          if (clip.type === "Clip" && region.start === clip.start) {
            const isHighlighted = clip.id === highlightedClipId;
            const display = (
              <WaveformClip
                clip={clip}
                region={region}
                regionIndex={i}
                index={i}
                key={clip.id}
                isHighlighted={isHighlighted}
                height={height}
                pixelsPerSecond={pixelsPerSecond}
                selectItem={selectItem}
              />
            );
            if (isHighlighted) highlightedClipDisplay = display;
            else return display;
          }
        });
      })}
      {highlightedClipDisplay}
    </g>
  );
};

export const Clips = React.memo(ClipsBase);

const WaveformClipBase = ({
  clip,
  isHighlighted,
  height,
  index,
  pixelsPerSecond,
  selectItem,
  region,
  regionIndex,
}: ClipProps) => {
  const { id, start, end } = clip;
  const clickDataProps: ClipClickDataProps = {
    "data-clip-id": id,
    "data-clip-start": start,
    "data-clip-end": end,
    "data-clip-index": index,
  };
  if (isHighlighted) clickDataProps["data-clip-is-highlighted"] = 1;

  const handleClick = useCallback(() => {
    if (!isHighlighted) selectItem(region, clip);
  }, [clip, region, selectItem, isHighlighted]);

  return (
    <g id={id} {...clickDataProps} onClick={handleClick}>
      <rect
        className={cn(
          css.waveformClip,
          { [css.highlightedClip]: isHighlighted }
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
};

export const WaveformClip = React.memo(WaveformClipBase);
