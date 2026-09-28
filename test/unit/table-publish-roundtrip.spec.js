import { describe, it, expect, beforeAll } from "vitest";
import { workbookHtml } from "../../builder/src/ui/publish-panel.js";
import { domToConfig } from "../../src/core/dom-config.js";
import { hydrateWorkbook } from "../../src/core/hydrate.js";
import { registerAllFields } from "../../src/fields/index.js";

beforeAll(() => {
  registerAllFields();
});

const config = {
  id: "table-workbook",
  title: "Table Workbook",
  worksheets: [
    {
      id: "worksheet-0",
      title: "Worksheet",
      sections: [
        {
          id: "section",
          title: "Section",
          fields: [
            {
              id: "activity_table",
              type: "table",
              label: "Activity table",
              allowAddRows: true,
              initialRows: 1,
              columns: [
                { id: "activity", label: "Activity", type: "short-text" },
                { id: "duration", label: "Duration", type: "number" },
                { id: "format", label: "Format", type: "dropdown", options: ["Solo", "Group"] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("published table field", () => {
  it("round-trips table settings from generated HTML", () => {
    const holder = document.createElement("div");
    holder.innerHTML = workbookHtml(config);
    const parsed = domToConfig(holder.querySelector(".lms-workbook"));
    const field = parsed.worksheets[0].sections[0].fields[0];
    expect(field.type).toBe("table");
    expect(field.allowAddRows).toBe(true);
    expect(field.columns.map((column) => column.type)).toEqual(["short-text", "number", "dropdown"]);
    expect(field.columns[2].options).toEqual(["Solo", "Group"]);
  });

  it("hydrates the pasted add-row button", async () => {
    const holder = document.createElement("div");
    holder.innerHTML = workbookHtml(config);
    const root = holder.querySelector(".lms-workbook");
    await hydrateWorkbook(root, {
      storage: {
        async get() {
          return null;
        },
        async set() {},
        async delete() {},
      },
    });
    root.querySelector(".wb-table-add-row").click();
    expect(root.querySelectorAll(".wb-table-input-row").length).toBe(2);
    expect(root.querySelectorAll("tbody input[type=number]").length).toBe(2);
    expect(root.querySelectorAll("tbody select").length).toBe(2);
  });
});
