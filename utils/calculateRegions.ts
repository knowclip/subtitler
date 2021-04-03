import { WaveformItem } from "../waveform/WaveformState";

export type WaveformRegion = {
  /** milliseconds */
  start: number;
  itemIds: string[];
  /** only for last */
  end?: number;
};

export const calculateRegions = (
  /** sorted by start. then end? */
  sortedItems: Omit<WaveformItem, "index">[],
  end: number
): {
  regions: WaveformRegion[];
  waveformItemsMap: Record<string, Omit<WaveformItem, "index">>;
} => {
  let regions: WaveformRegion[] = [{ start: 0, itemIds: [], end }];
  const waveformItemsMap: Record<string, Omit<WaveformItem, "index">> = {};
  for (const item of sortedItems) {
    regions = newRegionsWithItem(regions, waveformItemsMap, item);
  }

  return { regions, waveformItemsMap };
};

export function newRegionsWithItem(
  regions: WaveformRegion[],
  /** to be mutated */
  waveformItemsMap: Record<string, Omit<WaveformItem, "index">>,
  newItem: Omit<WaveformItem, "index">
): WaveformRegion[] {
  const newRegions: WaveformRegion[] = [];

  waveformItemsMap[newItem.id] = newItem;

  const end = regions[regions.length - 1].end!;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const regionEnd = getRegionEnd(regions[i + 1] || null, end);
    /// OFF BY ONE?
    const overlap = region.start <= newItem.end && regionEnd > newItem.start;

    if (overlap) {
      const splitRegions: WaveformRegion[] = [];

      if (newItem.start > region.start)
        splitRegions.push({
          start: region.start,
          itemIds: region.itemIds,
        });
      splitRegions.push({
        start: Math.max(newItem.start, region.start),
        itemIds: [...region.itemIds, newItem.id],
      });
      if (newItem.end < regionEnd)
        splitRegions.push({
          start: newItem.end,
          itemIds: region.itemIds,
        });

      const lastSplitRegion = splitRegions[splitRegions.length - 1];
      if ("end" in region) lastSplitRegion.end = region.end;
      newRegions.push(...splitRegions);
    } else {
      newRegions.push(region);
    }
  }

  return newRegions;
}

function getRegionEnd(nextRegion: WaveformRegion | null, end: number): number {
  if (!nextRegion) return end;
  const nextRegionStart = nextRegion.start;
  return nextRegionStart;
}
