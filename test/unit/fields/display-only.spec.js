import { describe, it, expect } from "vitest";
import { heading } from "../../../src/fields/heading.js";
import { instructions } from "../../../src/fields/instructions.js";
import { statement } from "../../../src/fields/statement.js";

describe.each([
  ["heading", heading, "h3"],
  ["instructions", instructions, "p"],
  ["statement", statement, "div"],
])("%s field (display only)", (_name, module, tag) => {
  const field = { id: "note", type: _name, label: "Some text" };

  it(`renders a ${tag} with the label text`, () => {
    const wrapper = module.render(field);
    expect(wrapper.querySelector(tag).textContent).toBe("Some text");
  });

  it("getValue returns undefined (no stored answer)", () => {
    const wrapper = module.render(field);
    expect(module.getValue(wrapper)).toBeUndefined();
  });

  it("validate always passes", () => {
    expect(module.validate(field, undefined)).toBe(true);
  });
});
