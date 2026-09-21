import { describe, it, expect } from "vitest";
import { radio } from "../../../src/fields/radio.js";

const field = {
  id: "priority",
  type: "radio",
  label: "Priority",
  required: true,
  options: ["Low", "Medium", "High"],
};

describe("radio field", () => {
  it("renders one radio input per option, sharing the field name", () => {
    const wrapper = radio.render(field, null);
    const inputs = wrapper.querySelectorAll('input[type="radio"]');
    expect(inputs.length).toBe(3);
    inputs.forEach((input) => expect(input.name).toBe("priority"));
  });

  it("getValue returns null when nothing is checked", () => {
    const wrapper = radio.render(field, null);
    expect(radio.getValue(wrapper)).toBeNull();
  });

  it("pre-checks the given value", () => {
    const wrapper = radio.render(field, "High");
    expect(radio.getValue(wrapper)).toBe("High");
  });

  it("setValue updates the checked option", () => {
    const wrapper = radio.render(field, "Low");
    radio.setValue(wrapper, "Medium");
    expect(radio.getValue(wrapper)).toBe("Medium");
  });

  it("required validation", () => {
    expect(radio.validate(field, null)).not.toBe(true);
    expect(radio.validate(field, "Low")).toBe(true);
  });
});
