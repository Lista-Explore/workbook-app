import { describe, it, expect } from "vitest";
import { FieldRegistry } from "../../src/fields/registry.js";
import { registerAllFields, DESIGNER_FIELD_TYPES } from "../../src/fields/index.js";

describe("registerAllFields", () => {
  it("registers a module for every designer-facing field type", () => {
    registerAllFields();
    for (const { type } of DESIGNER_FIELD_TYPES) {
      expect(FieldRegistry.has(type)).toBe(true);
    }
  });
});
