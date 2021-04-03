import { calculateRegions } from "./calculateRegions";

const item = (id: string, start: number, end: number) => ({
  id,
  start,
  end,
  type: "Clip" as const,
});

describe("calculateRegions", () => {
  it("calculates one end region", () => {
    const end = 10000;
    const { regions } = calculateRegions([], end);
    expect(regions).toEqual([
      {
        start: 0,
        itemIds: [],
        end: 10000,
      },
    ]);
  });

  it("calculates region for one item in middle", () => {
    const end = 10000;
    const { regions } = calculateRegions([item("a", 1, 4)], end);
    expect(regions).toEqual([
      { start: 0, itemIds: [] },
      { start: 1, itemIds: ["a"] },
      { start: 4, itemIds: [], end: 10000 },
    ]);
  });

  it("calculates region for one item at start", () => {
    const end = 10000;
    const { regions } = calculateRegions([item("a", 0, 5)], end);
    expect(regions).toEqual([
      { start: 0, itemIds: ["a"] },
      { start: 5, end: 10000, itemIds: [] },
    ]);
  });

  const region = (start: number, ...itemIds: string[]) => ({ start, itemIds });
  const endRegion = (start: number, end: number, ...itemIds: string[]) => ({
    start,
    end,
    itemIds,
  });

  it("calculates regions for separate items", () => {
    const end = 10000;
    const items = [item("a", 10, 20), item("b", 50, 60)];
    const { regions } = calculateRegions(items, end);
    expect(regions).toEqual([
      region(0),
      region(10, "a"),
      region(20),
      region(50, "b"),
      endRegion(60, 10000),
    ]);
  });

  it("calculates regions for a couple overlapping items", () => {
    const end = 10000;
    const items = [item("a", 10, 50), item("b", 20, 40), item("c", 60, 70)];
    const { regions } = calculateRegions(items, end);
    expect(regions).toEqual([
      region(0),
      region(10, "a"),
      region(20, "a", "b"),
      region(40, "a"),
      region(50),
      region(60, "c"),
      endRegion(70, 10000),
    ]);
  });

  it("calculates regions with overlaps", () => {
    const end = 10000;
    const items = [
      item("a", 10, 40),
      item("b", 30, 70),
      item("c", 80, 105),
    ];
    const { regions } = calculateRegions(items, end);
    expect(regions).toEqual([
      region(0),
      region(10, "a"),
      region(30, "a", "b"),
      region(40, "b"),
      region(70),
      region(80, "c"),
      endRegion(105, 10000),
    ]);
  });
});
