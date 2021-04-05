import React, { ReactNode } from "react";
import cn from "classnames";
import { getClipRectProps } from "./getClipRectProps";
import { msToPixels, SELECTION_BORDER_MILLISECONDS } from "./utils";
import { Clip, WaveformItem, WaveformState } from "./WaveformState";
import css from "./Waveform.module.scss";
import { WaveformRegion } from "../utils/calculateRegions";

type ClipClickDataProps = {
  "data-clip-id": string;
  "data-clip-start": number;
  "data-clip-end": number;
  "data-region-index": number;
  "data-clip-is-highlighted"?: number;
};

export const Clips = React.memo(ClipsBase);
function ClipsBase({
  waveformItems,
  regions,
  highlightedClipId,
  height,
  state: { pixelsPerSecond },
}: {
  waveformItems: Record<string, WaveformItem>;
  regions: WaveformRegion[];
  highlightedClipId: string | null;
  height: number;
  state: WaveformState;
}) {
  let highlightedClipDisplay: ReactNode;

  type Group = {
    clips: ClipDisplaySpecs[];
    slots: Array<string | null>;
  };
  type ClipDisplaySpecs = {
    clip: Clip;
    region: WaveformRegion;
    regionIndex: number;
    level: number;
  };

  const g = regions.reduce(
    (acc, region, regionIndex) => {
      const lastGroup: Group = acc[acc.length - 1];
      const { clips, slots } = lastGroup;

      const currentlyOverlapping = region.itemIds.length;
      if (!currentlyOverlapping) {
        if (!lastGroup || lastGroup.clips.length)
          acc.push({
            clips: [],
            slots: [],
          });
        return acc;
      }

      slots.forEach((slot, i) => {
        if (!region.itemIds.some((id) => id === slot)) {
          slots[i] = null;
        }
      });

      const startingNow = region.itemIds.flatMap((id) => {
        const clip = waveformItems[id];
        return clip.type === "Clip" && region.start === clip.start ? clip : [];
      });

      startingNow.forEach((clip) => {
        const emptySlot = slots.findIndex((id) => !id);
        const slotIndex = emptySlot === -1 ? slots.length : emptySlot;
        slots[slotIndex] = clip.id;

        const specs = {
          clip,
          region,
          regionIndex,
          level: slotIndex,
        };
        clips.push(specs);
      });

      return acc;
    },
    [{ clips: [], slots: [] }] as {
      clips: ClipDisplaySpecs[];
      slots: Array<string | null>;
    }[]
  );

  return (
    // className={$.waveformClipsContainer}
    <g>
      {g.flatMap((group) =>
        group.clips.flatMap(({ clip, regionIndex, region, level }) => {
          const isHighlighted = clip.id === highlightedClipId;
          const display = (
            <WaveformClip
              clip={clip}
              region={region}
              regionIndex={regionIndex}
              key={clip.id}
              isHighlighted={isHighlighted}
              height={height - (group.slots.length - 1) * 10}
              pixelsPerSecond={pixelsPerSecond}
              level={level}
            />
          );

          if (isHighlighted) highlightedClipDisplay = display;
          else return display;
        })
      )}
      {highlightedClipDisplay}
    </g>
  );
}

export const WaveformClip = React.memo(WaveformClipBase);
function WaveformClipBase({
  clip,
  isHighlighted,
  height,
  pixelsPerSecond,
  regionIndex,
  level,
}: {
  clip: Clip;
  region: WaveformRegion;
  isHighlighted: boolean;
  height: number;
  regionIndex: number;
  pixelsPerSecond: number;
  level: number;
}) {
  const { id, start, end } = clip;
  const clickDataProps: ClipClickDataProps = {
    "data-clip-id": id,
    "data-clip-start": start,
    "data-clip-end": end,
    "data-region-index": regionIndex,
  };
  if (isHighlighted) clickDataProps["data-clip-is-highlighted"] = 1;

  return (
    <g id={id} {...clickDataProps}>
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
        y={level * 10}
        {...clickDataProps}
      />

      <rect
        className={css.waveformClipBorder}
        x={msToPixels(start, pixelsPerSecond)}
        y={level * 1}
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
