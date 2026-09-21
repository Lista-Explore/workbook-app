import { describe, it, expect } from "vitest";
import { groupByColumn } from "../../src/core/column-layout.js";

describe("groupByColumn", () => {
  it("puts everything in one column when columnCount is 1, regardless of getColumn", () => {
    const result = groupByColumn(["a", "b", "c"], 1, () => 5);
    expect(result).toHaveLength(1);
    expect(result[0].map((e) => e.item)).toEqual(["a", "b", "c"]);
  });

  it("buckets items by their own explicit column assignment", () => {
    const items = [
      { label: "a", column: 0 },
      { label: "b", column: 1 },
      { label: "c", column: 0 },
      { label: "d", column: 1 },
    ];
    const result = groupByColumn(items, 2, (i) => i.column);
    expect(result[0].map((e) => e.item.label)).toEqual(["a", "c"]);
    expect(result[1].map((e) => e.item.label)).toEqual(["b", "d"]);
  });

  it("is stable: adding an item to one column never moves items already in another column", () => {
    const items = [
      { label: "a", column: 0 },
      { label: "b", column: 1 },
    ];
    const before = groupByColumn(items, 2, (i) => i.column);
    expect(before[1].map((e) => e.item.label)).toEqual(["b"]);

    // add two more items to column 0 only
    items.push({ label: "c", column: 0 }, { label: "d", column: 0 });
    const after = groupByColumn(items, 2, (i) => i.column);
    expect(after[0].map((e) => e.item.label)).toEqual(["a", "c", "d"]);
    // column 1 is untouched by growth in column 0
    expect(after[1].map((e) => e.item.label)).toEqual(["b"]);
  });

  it("defaults a missing/undefined column to 0", () => {
    const items = [{ label: "a" }, { label: "b", column: 1 }];
    const result = groupByColumn(items, 2, (i) => i.column);
    expect(result[0].map((e) => e.item.label)).toEqual(["a"]);
    expect(result[1].map((e) => e.item.label)).toEqual(["b"]);
  });

  it("clamps an out-of-range column (e.g. after the section's column count was reduced)", () => {
    const items = [{ label: "a", column: 2 }];
    const result = groupByColumn(items, 1, (i) => i.column);
    expect(result[0].map((e) => e.item.label)).toEqual(["a"]);
  });

  it("preserves each item's original flat index", () => {
    const items = [
      { label: "a", column: 0 },
      { label: "b", column: 1 },
      { label: "c", column: 0 },
    ];
    const result = groupByColumn(items, 2, (i) => i.column);
    expect(result[0].map((e) => e.index)).toEqual([0, 2]);
    expect(result[1].map((e) => e.index)).toEqual([1]);
  });

  it("returns one empty array per column when there are no items", () => {
    const result = groupByColumn([], 3, () => 0);
    expect(result).toEqual([[], [], []]);
  });
});
