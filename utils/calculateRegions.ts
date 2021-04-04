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
  end: number, // TODO: fix this awkward API
  /** to be mutated, must end with end region? */
  startRegions = [{ start: 0, itemIds: [], end }]
): {
  regions: WaveformRegion[];
  waveformItemsMap: Record<string, WaveformItem>;
} => {
  let regions: WaveformRegion[] = startRegions;
  const waveformItemsMap: Record<string, WaveformItem> = {};
  for (const item of sortedItems) {
    regions = newRegionsWithItem(regions, waveformItemsMap, item);
  }

  return { regions, waveformItemsMap };
};

export function newRegionsWithItem(
  regions: WaveformRegion[],
  /** to be mutated */
  waveformItemsMapWithNewItem: Record<string, WaveformItem>,
  newItem: WaveformItem
): WaveformRegion[] {
  const newRegions: WaveformRegion[] = [];

  waveformItemsMapWithNewItem[newItem.id] = newItem;

  // TODO: maybe don't always start at 0
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
  const end = regions[regions.length - 1].end;
  if (typeof end !== "number") throw new Error("No regions end found");
  const nextRegion: WaveformRegion | null = regions[index + 1] || null;
  if (!nextRegion) return end;
  const nextRegionStart = nextRegion.start;
  return nextRegionStart;
}
type Coords = { start: number; end: number };
function overlap(a: Coords, b: Coords) {
  return a.start <= b.end && a.end >= b.start;
}

export function recalculateRegions(
  regions: WaveformRegion[],
  oldItems: Record<string, WaveformItem>,
  targetId: string,
  newTarget: WaveformItem | null
) {
  const oldTarget = oldItems[targetId];
  const isAffected = (region: WaveformRegion, i: number): boolean => {
    const regionCoords = {
      start: region.start,
      end: getRegionEnd(regions, i),
    };
    return (
      overlap(regionCoords, oldTarget) ||
      Boolean(newTarget && overlap(regionCoords, newTarget))
    );
  };
  const affectedRegionsStart = search(regions, 0, regions.length, isAffected);

  if (affectedRegionsStart === -1)
    throw new Error("Invalid waveform state: target waveform item not found");

  const affectedRegionsEnd = searchFromEnd(
    regions,
    0,
    regions.length,
    isAffected
  );
  const recalculationStart = affectedRegionsStart;
  const recalculationEnd = affectedRegionsEnd;

  const itemsToBeIncluded: WaveformItem[] = [];
  for (let i = recalculationStart; i <= recalculationEnd; i++) {
    const region = regions[i];
    for (const id of region.itemIds) {
      const item = id === targetId ? newTarget : oldItems[id];
      if (item && !itemsToBeIncluded.includes(item))
        itemsToBeIncluded.push(item);
    }
  }
  itemsToBeIncluded.sort((a, b) => {
    const byStart = a.start - b.start;
    return byStart || b.end - a.end;
  });

  const end = getRegionEnd(regions, recalculationEnd);
  const changedRegions = calculateRegions(itemsToBeIncluded, end, [
    {
      start: regions[recalculationStart].start,
      itemIds: [],
      end,
    },
  ]);

  const pre = regions.slice(0, recalculationStart);
  const post = regions.slice(recalculationEnd);

  if (
    pre.length &&
    changedRegions.regions.length &&
    setsAreEqual(
      new Set(pre[pre.length - 1].itemIds),
      new Set(changedRegions.regions[0].itemIds)
    )
  ) {
    changedRegions.regions.shift();
  }

  if (
    post.length &&
    changedRegions.regions.length &&
    setsAreEqual(
      new Set(post[0].itemIds),
      new Set(changedRegions.regions[changedRegions.regions.length - 1].itemIds)
    )
  ) {
    post.shift();
    // THIS WILL DELETE END??
  }

  if (post.length) {
    delete changedRegions.regions[changedRegions.regions.length - 1].end;
  }

  return [...pre, ...changedRegions.regions, ...post];
}

function setsAreEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}

function search<T>(
  arr: T[],
  start: number,
  endExclusive: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = start; i < endExclusive; i++) {
    if (predicate(arr[i], i)) return i;
  }

  return -1;
}

// TODO: optimize by searching from same direction with more sophisticated overlap tracking
function searchFromEnd<T>(
  arr: T[],
  start: number,
  endExclusive: number,
  predicate: (element: T, index: number) => boolean
): number {
  for (let i = endExclusive - 1; i >= start; i--) {
    if (predicate(arr[i], i)) return i;
  }

  return -1;
}
