import { describe, it, expect, beforeAll } from "vitest";
import { renderWorkbook } from "../../src/core/renderer.js";
import { registerAllFields } from "../../src/fields/index.js";

beforeAll(() => {
  registerAllFields();
});

const config = {
  id: "wb1",
  title: "Test Workbook",
  worksheets: [
    { id: "ws1", title: "Worksheet 1", sections: [{ id: "s1", fields: [{ id: "a", type: "short-text", label: "A" }] }] },
    { id: "ws2", title: "Worksheet 2", sections: [{ id: "s2", fields: [{ id: "b", type: "short-text", label: "B" }] }] },
    { id: "ws3", title: "Worksheet 3", sections: [{ id: "s3", fields: [{ id: "c", type: "short-text", label: "C" }] }] },
  ],
};

describe("renderWorkbook", () => {
  it("renders the title and all worksheet panels", () => {
    const mount = document.createElement("div");
    renderWorkbook(config, mount);
    expect(mount.querySelector(".wb-title").textContent).toBe("Test Workbook");
    expect(mount.querySelectorAll(".wb-worksheet-panel").length).toBe(3);
  });

  it("only shows the first worksheet panel initially", () => {
    const mount = document.createElement("div");
    renderWorkbook(config, mount);
    const panels = mount.querySelectorAll(".wb-worksheet-panel");
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
    expect(panels[2].hidden).toBe(true);
  });

  it("every worksheet tab beyond the second is clickable and switches the panel", () => {
    const mount = document.createElement("div");
    renderWorkbook(config, mount);
    const tabs = mount.querySelectorAll(".wb-tab");
    tabs[2].click();
    const panels = mount.querySelectorAll(".wb-worksheet-panel");
    expect(panels[2].hidden).toBe(false);
    expect(panels[0].hidden).toBe(true);
  });

  it("pre-fills fields from the given data", () => {
    const mount = document.createElement("div");
    renderWorkbook(config, mount, { data: { worksheets: { ws1: { a: "hello" } } } });
    expect(mount.querySelector("#a").value).toBe("hello");
  });

  it("calls onFieldChange with worksheetId, fieldId, value", () => {
    const mount = document.createElement("div");
    const changes = [];
    renderWorkbook(config, mount, {
      onFieldChange: (worksheetId, fieldId, value) => changes.push({ worksheetId, fieldId, value }),
    });
    const input = mount.querySelector("#a");
    input.value = "typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(changes).toEqual([{ worksheetId: "ws1", fieldId: "a", value: "typed" }]);
  });

  it("does not render tabs for a single-worksheet workbook", () => {
    const singleConfig = { id: "wb2", worksheets: [config.worksheets[0]] };
    const mount = document.createElement("div");
    renderWorkbook(singleConfig, mount);
    expect(mount.querySelector(".wb-tabs")).toBeNull();
  });

  it("exposes a showWorksheet handle that switches panels programmatically", () => {
    const mount = document.createElement("div");
    const handle = renderWorkbook(config, mount);
    handle.showWorksheet(1);
    const panels = mount.querySelectorAll(".wb-worksheet-panel");
    expect(panels[1].hidden).toBe(false);
  });
});
