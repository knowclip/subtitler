import React, { ReactNode, useCallback } from "react";
import cn from "classnames";
import { getClipRectProps } from "./getClipRectProps";
import { msToPixels, pixelsToMs, SELECTION_BORDER_MILLISECONDS } from "./utils";
import { Clip, WaveformItem, WaveformState } from "./WaveformState";
import css from "./Waveform.module.scss";
import { getRegionEnd, WaveformRegion } from "../utils/calculateRegions";
import { MAX_WAVEFORM_VIEWPORT_WIDTH } from "./useWaveform";

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
  state: {pixelsPerSecond, viewBoxStartMs},
  selectItem,
}: {
  waveformItems: Record<string, WaveformItem>;
  regions: WaveformRegion[];
  highlightedClipId: string | null;
  height: number;
  state: WaveformState;
  selectItem: (region: WaveformRegion, clip: WaveformItem) => void;
}) => {
  let highlightedClipDisplay: ReactNode;

  return (
    // className={$.waveformClipsContainer}
    <g>
      {regions.flatMap((region, i) => {
        if (getRegionEnd(regions, i) < viewBoxStartMs || region.start > viewBoxStartMs + pixelsToMs(MAX_WAVEFORM_VIEWPORT_WIDTH, pixelsPerSecond)) return []
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
