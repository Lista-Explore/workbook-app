import { describe, it, expect } from "vitest";
import { slugify, generateId } from "../../src/core/id-generator.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Customer Name")).toBe("customer-name");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("What's your name?")).toBe("what-s-your-name");
  });

  it("falls back to item for empty input", () => {
    expect(slugify("")).toBe("item");
    expect(slugify(null)).toBe("item");
  });
});

describe("generateId", () => {
  it("generates a slug from the label", () => {
    const used = new Set();
    expect(generateId("Customer Name", 0, used)).toBe("customer-name");
  });

  it("falls back to positional id when no label given", () => {
    const used = new Set();
    expect(generateId("", 3, used)).toBe("item-3");
  });

  it("avoids collisions by appending a numeric suffix", () => {
    const used = new Set(["customer-name"]);
    expect(generateId("Customer Name", 1, used)).toBe("customer-name-2");
  });

  it("registers generated ids in the used set", () => {
    const used = new Set();
    generateId("Customer Name", 0, used);
    expect(used.has("customer-name")).toBe(true);
  });

  it("is deterministic for the same label/position on a fresh used set", () => {
    const a = generateId("Customer Name", 0, new Set());
    const b = generateId("Customer Name", 0, new Set());
    expect(a).toBe(b);
  });
});
