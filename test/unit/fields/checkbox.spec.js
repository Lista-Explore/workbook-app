import { describe, it, expect } from "vitest";
import { checkbox } from "../../../src/fields/checkbox.js";

const field = { id: "agree", type: "checkbox", label: "I agree", required: true };

describe("checkbox field", () => {
  it("renders unchecked by default", () => {
    const wrapper = checkbox.render(field, null);
    expect(checkbox.getValue(wrapper)).toBe(false);
  });

  it("renders checked when value is truthy", () => {
    const wrapper = checkbox.render(field, true);
    expect(checkbox.getValue(wrapper)).toBe(true);
  });

  it("setValue toggles state", () => {
    const wrapper = checkbox.render(field, false);
    checkbox.setValue(wrapper, true);
    expect(checkbox.getValue(wrapper)).toBe(true);
  });

  it("required validation fails when unchecked", () => {
    expect(checkbox.validate(field, false)).not.toBe(true);
    expect(checkbox.validate(field, true)).toBe(true);
  });
});
