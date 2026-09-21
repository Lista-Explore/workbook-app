import { describe, it, expect } from "vitest";
import { checkboxGroup } from "../../../src/fields/checkbox-group.js";

const field = {
  id: "needs",
  type: "checkbox-group",
  label: "Needs",
  required: true,
  options: ["Speed", "Lower cost", "Quality", "Support"],
};

describe("checkboxGroup field", () => {
  it("renders one checkbox per option", () => {
    const wrapper = checkboxGroup.render(field, []);
    expect(wrapper.querySelectorAll('input[type="checkbox"]').length).toBe(4);
  });

  it("pre-checks values in the given array", () => {
    const wrapper = checkboxGroup.render(field, ["Speed", "Support"]);
    expect(checkboxGroup.getValue(wrapper).sort()).toEqual(["Speed", "Support"].sort());
  });

  it("setValue replaces the checked set", () => {
    const wrapper = checkboxGroup.render(field, ["Speed"]);
    checkboxGroup.setValue(wrapper, ["Quality"]);
    expect(checkboxGroup.getValue(wrapper)).toEqual(["Quality"]);
  });

  it("required validation fails when nothing selected", () => {
    expect(checkboxGroup.validate(field, [])).not.toBe(true);
    expect(checkboxGroup.validate(field, ["Speed"])).toBe(true);
  });
});
