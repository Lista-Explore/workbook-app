import { describe, it, expect } from "vitest";
import { computeProgress } from "../../src/core/progress.js";

const config = {
  worksheets: [
    {
      id: "ws1",
      sections: [
        {
          fields: [
            { id: "a", type: "short-text", required: true },
            { id: "b", type: "short-text", required: true },
            { id: "c", type: "short-text", required: false },
            { id: "heading1", type: "heading", required: true }, // display-only, ignored
          ],
        },
      ],
    },
  ],
};

describe("computeProgress", () => {
  it("counts only required, non-display-only fields toward the total", () => {
    const progress = computeProgress(config, { worksheets: { ws1: {} } });
    expect(progress.total).toBe(2);
  });

  it("reports 0% when nothing is answered", () => {
    const progress = computeProgress(config, { worksheets: { ws1: {} } });
    expect(progress.answered).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it("reports 50% when half the required fields are answered", () => {
    const progress = computeProgress(config, { worksheets: { ws1: { a: "x" } } });
    expect(progress.percent).toBe(50);
  });

  it("reports 100% when all required fields are answered", () => {
    const progress = computeProgress(config, { worksheets: { ws1: { a: "x", b: "y" } } });
    expect(progress.percent).toBe(100);
  });

  it("treats an empty array/false/empty-string as unanswered", () => {
    const progress = computeProgress(config, { worksheets: { ws1: { a: "", b: false } } });
    expect(progress.answered).toBe(0);
  });

  it("returns 100% when there are no required fields at all", () => {
    const emptyConfig = { worksheets: [{ id: "ws1", sections: [{ fields: [] }] }] };
    const progress = computeProgress(emptyConfig, {});
    expect(progress.percent).toBe(100);
  });
});
