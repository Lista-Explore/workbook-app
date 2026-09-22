import { describe, it, expect, beforeAll } from "vitest";
import { renderWorkbook } from "../../src/core/renderer.js";
import { registerAllFields } from "../../src/fields/index.js";
import { domToConfig } from "../../src/core/dom-config.js";

beforeAll(() => {
  registerAllFields();
});

function renderAndReconstruct(config) {
  const mount = document.createElement("div");
  mount.dataset.workbook = config.id;
  renderWorkbook(config, mount);
  return domToConfig(mount);
}

describe("domToConfig — reconstructing structure from already-rendered HTML", () => {
  it("recovers id, title, and simple text fields with their labels and required flag", () => {
    const config = {
      id: "wb1",
      title: "My Workbook",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              title: "Section 1",
              fields: [
                { id: "a", type: "short-text", label: "Your name?", required: true, column: 0 },
                { id: "b", type: "long-text", label: "Comments", required: false, column: 0 },
              ],
            },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    expect(rebuilt.id).toBe("wb1");
    expect(rebuilt.title).toBe("My Workbook");
    const fields = rebuilt.worksheets[0].sections[0].fields;
    expect(fields[0]).toMatchObject({ id: "a", type: "short-text", label: "Your name?", required: true });
    expect(fields[1]).toMatchObject({ id: "b", type: "long-text", label: "Comments", required: false });
  });

  it("recovers each field's column from its position among .wb-column siblings", () => {
    const config = {
      id: "wb2",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              columns: 2,
              fields: [
                { id: "left", type: "short-text", label: "Left", column: 0 },
                { id: "right", type: "short-text", label: "Right", column: 1 },
              ],
            },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const fields = rebuilt.worksheets[0].sections[0].fields;
    expect(fields.find((f) => f.id === "left").column).toBe(0);
    expect(fields.find((f) => f.id === "right").column).toBe(1);
  });

  it("recovers options for radio, checkbox-group, and dropdown fields", () => {
    const config = {
      id: "wb3",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              fields: [
                { id: "r", type: "radio", label: "Pick one", options: ["Red", "Blue"], column: 0 },
                { id: "c", type: "checkbox-group", label: "Pick many", options: ["A", "B", "C"], column: 0 },
                { id: "d", type: "dropdown", label: "Choose", options: ["X", "Y"], column: 0 },
              ],
            },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const fields = rebuilt.worksheets[0].sections[0].fields;
    expect(fields.find((f) => f.id === "r").options).toEqual(["Red", "Blue"]);
    expect(fields.find((f) => f.id === "c").options).toEqual(["A", "B", "C"]);
    expect(fields.find((f) => f.id === "d").options).toEqual(["X", "Y"]);
  });

  it("recovers a checklist's options and per-item dependsOn (item 2 can depend on item 0 directly, not just the one before it)", () => {
    const config = {
      id: "wb-checklist",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              fields: [
                {
                  id: "steps",
                  type: "checklist",
                  label: "Steps",
                  options: ["First", "Second", "Third"],
                  dependsOn: [null, null, 0],
                  column: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const field = rebuilt.worksheets[0].sections[0].fields[0];
    expect(field.options).toEqual(["First", "Second", "Third"]);
    expect(field.dependsOn).toEqual([null, null, 0]);
  });

  it("recovers a checkbox field's label and required flag from its inline ' *' marker", () => {
    const config = {
      id: "wb4",
      worksheets: [
        {
          id: "ws1",
          sections: [
            { id: "s1", fields: [{ id: "agree", type: "checkbox", label: "I agree", required: true, column: 0 }] },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const field = rebuilt.worksheets[0].sections[0].fields[0];
    expect(field.label).toBe("I agree");
    expect(field.required).toBe(true);
  });

  it("recovers an image field's src, alt, and caption", () => {
    const config = {
      id: "wb5",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              fields: [
                { id: "pic", type: "image", src: "https://example.com/a.png", alt: "A picture", caption: "Fig 1", column: 0 },
              ],
            },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const field = rebuilt.worksheets[0].sections[0].fields[0];
    expect(field.src).toBe("https://example.com/a.png");
    expect(field.alt).toBe("A picture");
    expect(field.caption).toBe("Fig 1");
  });

  it("recovers each section's columns count and title", () => {
    const config = {
      id: "wb6",
      worksheets: [
        {
          id: "ws1",
          sections: [
            { id: "s1", title: "Section One", columns: 3, fields: [{ id: "a", type: "short-text", label: "A", column: 0 }] },
          ],
        },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    const section = rebuilt.worksheets[0].sections[0];
    expect(section.title).toBe("Section One");
    expect(section.columns).toBe(3);
  });

  it("recovers worksheet titles from the tab labels when there is more than one worksheet", () => {
    const config = {
      id: "wb7",
      worksheets: [
        { id: "ws1", title: "First", sections: [{ id: "s1", fields: [] }] },
        { id: "ws2", title: "Second", sections: [{ id: "s2", fields: [] }] },
      ],
    };

    const rebuilt = renderAndReconstruct(config);
    expect(rebuilt.worksheets[0].title).toBe("First");
    expect(rebuilt.worksheets[1].title).toBe("Second");
  });
});
