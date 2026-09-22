import { describe, it, expect, beforeEach } from "vitest";
import { BuilderState } from "../../builder/src/builder-state.js";

let state;

beforeEach(() => {
  state = new BuilderState();
});

describe("BuilderState — worksheets", () => {
  it("adds a worksheet with a generated id", () => {
    const ws = state.addWorksheet("Customer Profile");
    expect(ws.id).toBe("customer-profile");
    expect(state.workbook.worksheets).toHaveLength(1);
  });

  it("avoids id collisions between worksheets with the same title", () => {
    const a = state.addWorksheet("Reflection");
    const b = state.addWorksheet("Reflection");
    expect(a.id).not.toBe(b.id);
  });

  it("removes a worksheet by id", () => {
    const ws = state.addWorksheet("A");
    state.addWorksheet("B");
    state.removeWorksheet(ws.id);
    expect(state.workbook.worksheets).toHaveLength(1);
    expect(state.workbook.worksheets[0].title).toBe("B");
  });

  it("reorders worksheets", () => {
    const a = state.addWorksheet("A");
    state.addWorksheet("B");
    state.addWorksheet("C");
    state.reorderWorksheet(a.id, 2);
    expect(state.workbook.worksheets.map((w) => w.title)).toEqual(["B", "C", "A"]);
  });
});

describe("BuilderState — workbook id derivation", () => {
  it("derives the workbook id from the title, the same way other ids are generated", () => {
    state.setTitle("Customer Analysis Workbook");
    expect(state.workbook.id).toBe("customer-analysis-workbook");
  });

  it("does not require a manual id — setting only the title is enough", () => {
    expect(state.workbook.id).toBe("");
    state.setTitle("My Workbook");
    expect(state.workbook.id).toBe("my-workbook");
  });

  it("keeps the id stable once set, even if the title is edited again later", () => {
    state.setTitle("First Title");
    const idAfterFirst = state.workbook.id;
    state.setTitle("A Completely Different Title");
    expect(state.workbook.id).toBe(idAfterFirst);
  });

  it("does not set an id for a blank/whitespace-only title", () => {
    state.setTitle("   ");
    expect(state.workbook.id).toBe("");
  });

  it("setId remains available as a manual override escape hatch", () => {
    state.setId("custom-id");
    expect(state.workbook.id).toBe("custom-id");
  });
});

describe("BuilderState — sections", () => {
  it("adds a section to a worksheet with the given columns, always collapsible", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id, { title: "Basic Info", columns: 2 });
    expect(section.columns).toBe(2);
    expect(section.collapsible).toBe(true);
    expect(ws.sections).toHaveLength(1);
  });

  it("removes a section", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    state.removeSection(ws.id, section.id);
    expect(ws.sections).toHaveLength(0);
  });

  it("updates a section's settings", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id, { columns: 1 });
    state.updateSection(ws.id, section.id, { columns: 3, collapsible: true });
    expect(section.columns).toBe(3);
    expect(section.collapsible).toBe(true);
  });

  it("reorders sections within a worksheet", () => {
    const ws = state.addWorksheet("WS1");
    const a = state.addSection(ws.id, { title: "A" });
    state.addSection(ws.id, { title: "B" });
    state.reorderSection(ws.id, a.id, 1);
    expect(ws.sections.map((s) => s.title)).toEqual(["B", "A"]);
  });

  it("throws a clear error for an unknown worksheet", () => {
    expect(() => state.addSection("nope")).toThrow(/not found/);
  });
});

describe("BuilderState — fields", () => {
  it("adds a field to a section with a generated id", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const field = state.addField(ws.id, section.id, { type: "short-text", label: "Customer name" });
    expect(field.id).toBe("customer-name");
    expect(field.type).toBe("short-text");
    expect(section.fields).toHaveLength(1);
  });

  it("defaults required to false", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const field = state.addField(ws.id, section.id, { type: "short-text", label: "X" });
    expect(field.required).toBe(false);
  });

  it("inserts a field at a specific index instead of always appending", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    state.addField(ws.id, section.id, { type: "short-text", label: "A" });
    state.addField(ws.id, section.id, { type: "short-text", label: "C" });
    state.addField(ws.id, section.id, { type: "short-text", label: "B" }, 1);
    expect(section.fields.map((f) => f.label)).toEqual(["A", "B", "C"]);
  });

  it("inserting far beyond the end just appends, without throwing", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    state.addField(ws.id, section.id, { type: "short-text", label: "A" });
    const field = state.addField(ws.id, section.id, { type: "short-text", label: "B" }, 99);
    expect(section.fields[section.fields.length - 1]).toBe(field);
  });

  it("removes a field", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const field = state.addField(ws.id, section.id, { type: "short-text", label: "X" });
    state.removeField(ws.id, section.id, field.id);
    expect(section.fields).toHaveLength(0);
  });

  it("updates a field's config (e.g. options list, required flag)", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const field = state.addField(ws.id, section.id, { type: "dropdown", label: "Type", options: [] });
    state.updateField(ws.id, section.id, field.id, { options: ["A", "B"], required: true });
    expect(field.options).toEqual(["A", "B"]);
    expect(field.required).toBe(true);
  });

  it("reorders fields within a section", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const a = state.addField(ws.id, section.id, { type: "short-text", label: "A" });
    state.addField(ws.id, section.id, { type: "short-text", label: "B" });
    state.reorderField(ws.id, section.id, a.id, 1);
    expect(section.fields.map((f) => f.label)).toEqual(["B", "A"]);
  });

  it("keeps field ids stable across unrelated edits", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    const field = state.addField(ws.id, section.id, { type: "short-text", label: "Customer name" });
    const idBefore = field.id;
    state.updateField(ws.id, section.id, field.id, { required: true });
    expect(field.id).toBe(idBefore);
  });
});

describe("BuilderState.reset", () => {
  it("discards everything and returns to a blank workbook", () => {
    state.setId("wb-1");
    state.setTitle("My Workbook");
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    state.addField(ws.id, section.id, { type: "short-text", label: "Name" });

    state.reset();

    expect(state.workbook.id).toBe("");
    expect(state.workbook.title).toBe("");
    expect(state.workbook.worksheets).toHaveLength(0);
  });

  it("frees up previously-used ids so they can be reused after resetting", () => {
    const ws = state.addWorksheet("Reflection");
    expect(ws.id).toBe("reflection");

    state.reset();

    const again = state.addWorksheet("Reflection");
    expect(again.id).toBe("reflection");
  });
});

describe("BuilderState.toConfig", () => {
  it("produces a plain, deep-cloned workbook definition", () => {
    const ws = state.addWorksheet("WS1");
    const section = state.addSection(ws.id);
    state.addField(ws.id, section.id, { type: "short-text", label: "Name" });
    const config = state.toConfig();
    expect(config.worksheets[0].sections[0].fields[0].label).toBe("Name");
    // mutating the returned config must not affect internal state
    config.worksheets[0].title = "mutated";
    expect(state.workbook.worksheets[0].title).toBe("WS1");
  });
});
