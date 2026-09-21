import { describe, it, expect } from "vitest";
import { file } from "../../../src/fields/file.js";

const field = { id: "upload", type: "file", label: "Upload", required: true };

describe("file field", () => {
  it("renders an <input type=file>", () => {
    const wrapper = file.render(field, null);
    expect(wrapper.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("getValue returns null when no file chosen", () => {
    const wrapper = file.render(field, null);
    expect(file.getValue(wrapper)).toBeNull();
  });

  it("shows a note when a previous filename is passed in", () => {
    const wrapper = file.render(field, "report.pdf");
    expect(wrapper.textContent).toContain("report.pdf");
  });

  it("setValue is a safe no-op (files cannot be restored)", () => {
    const wrapper = file.render(field, null);
    expect(() => file.setValue(wrapper, "whatever.pdf")).not.toThrow();
  });

  it("required validation fails without a value", () => {
    expect(file.validate(field, null)).not.toBe(true);
    expect(file.validate(field, "report.pdf")).toBe(true);
  });
});
