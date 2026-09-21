import { describe, it, expect } from "vitest";
import { dropdown } from "../../../src/fields/dropdown.js";

const field = {
  id: "customer_type",
  type: "dropdown",
  label: "Customer type",
  required: true,
  options: ["Individual", "Business", "Government"],
};

describe("dropdown field", () => {
  it("renders one option per configured option plus a blank", () => {
    const wrapper = dropdown.render(field, null);
    const options = wrapper.querySelectorAll("option");
    expect(options.length).toBe(4);
    expect(options[1].value).toBe("Individual");
  });

  it("pre-selects the given value", () => {
    const wrapper = dropdown.render(field, "Business");
    expect(dropdown.getValue(wrapper)).toBe("Business");
  });

  it("setValue updates selection", () => {
    const wrapper = dropdown.render(field, null);
    dropdown.setValue(wrapper, "Government");
    expect(dropdown.getValue(wrapper)).toBe("Government");
  });

  it("required validation fails on blank selection", () => {
    expect(dropdown.validate(field, "")).not.toBe(true);
    expect(dropdown.validate(field, "Individual")).toBe(true);
  });
});
