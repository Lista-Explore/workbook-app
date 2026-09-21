import { describe, it, expect } from "vitest";
import { listWorkbookFields, matchFields } from "../../src/pdf/field-matcher.js";

const config = {
  worksheets: [
    {
      id: "ws1",
      sections: [
        {
          fields: [
            { id: "customer_name", type: "short-text" },
            { id: "reflection", type: "long-text" },
          ],
        },
      ],
    },
  ],
};

describe("listWorkbookFields", () => {
  it("flattens worksheets/sections/fields into a single list", () => {
    const list = listWorkbookFields(config);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ worksheetId: "ws1", fieldId: "customer_name" });
  });
});

describe("matchFields", () => {
  it("matches workbook fields whose id appears in the PDF field list", () => {
    const { matched } = matchFields(config, ["customer_name", "reflection"]);
    expect(matched).toHaveLength(2);
  });

  it("reports PDF fields with no matching workbook field", () => {
    const { unmatchedInPdf } = matchFields(config, ["customer_name", "student_signature"]);
    expect(unmatchedInPdf).toEqual(["student_signature"]);
  });

  it("reports workbook fields with no matching PDF field", () => {
    const { unmatchedInWorkbook } = matchFields(config, ["customer_name"]);
    expect(unmatchedInWorkbook.map((f) => f.fieldId)).toEqual(["reflection"]);
  });

  it("returns empty mismatch lists when everything matches exactly", () => {
    const result = matchFields(config, ["customer_name", "reflection"]);
    expect(result.unmatchedInPdf).toEqual([]);
    expect(result.unmatchedInWorkbook).toEqual([]);
  });
});
