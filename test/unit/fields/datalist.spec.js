import { describe, it, expect } from "vitest";
import { datalist } from "../../../src/fields/datalist.js";

const field = {
  id: "role",
  type: "datalist",
  label: "Role",
  options: ["Manager", "Engineer", "Designer"],
};

describe("datalist field", () => {
  it("renders a text input linked to a <datalist> of options", () => {
    const wrapper = datalist.render(field, null);
    const input = wrapper.querySelector("input[type=text]");
    const list = wrapper.querySelector("datalist");
    expect(input.getAttribute("list")).toBe(list.id);
    expect(list.querySelectorAll("option").length).toBe(3);
  });

  it("accepts free text not in the options", () => {
    const wrapper = datalist.render(field, null);
    datalist.setValue(wrapper, "Something else");
    expect(datalist.getValue(wrapper)).toBe("Something else");
  });
});
