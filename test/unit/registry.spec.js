import { describe, it, expect, beforeEach } from "vitest";
import { FieldRegistry } from "../../src/fields/registry.js";
import { shortText } from "../../src/fields/short-text.js";

describe("FieldRegistry", () => {
  beforeEach(() => {
    FieldRegistry.register("short-text", shortText);
  });

  it("registers and retrieves a field module", () => {
    expect(FieldRegistry.get("short-text")).toBe(shortText);
  });

  it("reports whether a type is registered", () => {
    expect(FieldRegistry.has("short-text")).toBe(true);
    expect(FieldRegistry.has("does-not-exist")).toBe(false);
  });

  it("throws a clear error for an unknown type", () => {
    expect(() => FieldRegistry.get("does-not-exist")).toThrow(/Unknown field type/);
  });

  it("lists all registered types", () => {
    expect(FieldRegistry.types()).toContain("short-text");
  });
});
