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
  sortedItems: WaveformItem[],
  end: number
): {
  regions: WaveformRegion[];
  waveformItemsMap: Record<string, WaveformItem>;
} => {
  let regions: WaveformRegion[] = [{ start: 0, itemIds: [], end }];
  const waveformItemsMap: Record<string, WaveformItem> = {};
  for (const item of sortedItems) {
    regions = newRegionsWithItem(regions, waveformItemsMap, item);
  }

  return { regions, waveformItemsMap };
};

export function newRegionsWithItem(
  regions: WaveformRegion[],
  /** to be mutated */
  waveformItemsMap: Record<string, WaveformItem>,
  newItem: WaveformItem
): WaveformRegion[] {
  const newRegions: WaveformRegion[] = [];

  waveformItemsMap[newItem.id] = newItem;


  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const regionEnd = getRegionEnd(regions, i);
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

export function getRegionEnd(regions: WaveformRegion[], index: number): number {
  const end = regions[regions.length - 1].end!;
  const nextRegion: WaveformRegion | null = regions[index + 1] || null
  if (!nextRegion) return end;
  const nextRegionStart = nextRegion.start;
  return nextRegionStart;
}
