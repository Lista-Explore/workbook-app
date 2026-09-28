import { describe, it, expect } from "vitest";
import { table, addTableInputRow } from "../../../src/fields/table.js";

const field = {
  id: "materials",
  type: "table",
  label: "Materials",
  required: true,
  allowAddRows: true,
  initialRows: 1,
  columns: [
    { id: "item", label: "Item", type: "short-text" },
    { id: "qty", label: "Qty", type: "number" },
    { id: "notes", label: "Notes", type: "long-text" },
    { id: "status", label: "Status", type: "dropdown", options: ["Ready", "Backordered"] },
    { id: "hint", label: "Hint", type: "content", content: "<strong>Check stock</strong>" },
  ],
};

describe("table field", () => {
  it("renders configured columns and learner add-row control", () => {
    const wrapper = table.render(field, null);
    expect(wrapper.querySelectorAll("th").length).toBe(5);
    expect(wrapper.querySelector("input[type=text]")).not.toBeNull();
    expect(wrapper.querySelector("input[type=number]")).not.toBeNull();
    expect(wrapper.querySelector("textarea")).not.toBeNull();
    expect(wrapper.querySelector("select option[value=Ready]")).not.toBeNull();
    expect(wrapper.querySelector(".wb-table-cell-content").innerHTML).toContain("<strong>Check stock</strong>");
    expect(wrapper.querySelector(".wb-table-add-row")).not.toBeNull();
  });

  it("gets and sets row values without treating content columns as answers", () => {
    const wrapper = table.render(field, [
      { item: "Paper", qty: "2", notes: "A4", status: "Ready" },
      { item: "Ink", qty: "1", notes: "", status: "Backordered" },
    ]);

    expect(table.getValue(wrapper)).toEqual([
      { item: "Paper", qty: "2", notes: "A4", status: "Ready" },
      { item: "Ink", qty: "1", notes: "", status: "Backordered" },
    ]);

    table.setValue(wrapper, [{ item: "Pens", qty: "10", notes: "Blue", status: "Ready" }]);
    expect(wrapper.querySelectorAll(".wb-table-input-row").length).toBe(1);
    expect(table.getValue(wrapper)[0]).toEqual({ item: "Pens", qty: "10", notes: "Blue", status: "Ready" });
  });

  it("adds rows that mimic the configured column controls", () => {
    const wrapper = table.render(field, null);
    addTableInputRow(wrapper);
    expect(wrapper.querySelectorAll(".wb-table-input-row").length).toBe(2);
    expect(wrapper.querySelectorAll("tbody input[type=number]").length).toBe(2);
    expect(wrapper.querySelectorAll("tbody textarea").length).toBe(2);
    expect(wrapper.querySelectorAll("tbody select").length).toBe(2);
  });

  it("validates required tables when at least one editable cell is filled", () => {
    expect(table.validate(field, [{ item: "", qty: "", notes: "", status: "" }])).not.toBe(true);
    expect(table.validate(field, [{ item: "Paper", qty: "", notes: "", status: "" }])).toBe(true);
  });
});
