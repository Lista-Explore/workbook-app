import { describe, it, expect, beforeAll } from "vitest";
import { validateWorkbook } from "../../src/core/validation.js";
import { registerAllFields } from "../../src/fields/index.js";

beforeAll(() => {
  registerAllFields();
});

const config = {
  id: "wb1",
  worksheets: [
    {
      id: "ws1",
      sections: [
        {
          id: "s1",
          fields: [
            { id: "name", type: "short-text", label: "Name", required: true },
            { id: "notes", type: "long-text", label: "Notes" },
          ],
        },
      ],
    },
  ],
};

describe("validateWorkbook", () => {
  it("returns a failure for a missing required field", () => {
    const failures = validateWorkbook(config, { worksheets: { ws1: {} } });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ worksheetId: "ws1", fieldId: "name" });
  });

  it("returns no failures when required fields are filled", () => {
    const failures = validateWorkbook(config, { worksheets: { ws1: { name: "Acme" } } });
    expect(failures).toHaveLength(0);
  });

  it("does not flag optional fields when empty", () => {
    const failures = validateWorkbook(config, { worksheets: { ws1: { name: "Acme", notes: "" } } });
    expect(failures).toHaveLength(0);
  });

  it("handles completely missing data gracefully", () => {
    const failures = validateWorkbook(config, {});
    expect(failures).toHaveLength(1);
  });
});
