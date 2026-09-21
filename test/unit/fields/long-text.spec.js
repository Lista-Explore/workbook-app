import { describe, it, expect } from "vitest";
import { longText } from "../../../src/fields/long-text.js";

const field = { id: "reflection", type: "long-text", label: "Reflection", required: true };

describe("longText field", () => {
  it("renders a textarea", () => {
    const wrapper = longText.render(field, null);
    expect(wrapper.querySelector("textarea")).not.toBeNull();
  });

  it("round-trips a value", () => {
    const wrapper = longText.render(field, null);
    longText.setValue(wrapper, "some paragraph");
    expect(longText.getValue(wrapper)).toBe("some paragraph");
  });

  it("required validation", () => {
    expect(longText.validate(field, "")).not.toBe(true);
    expect(longText.validate(field, "text")).toBe(true);
  });
});
