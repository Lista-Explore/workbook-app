import { describe, it, expect } from "vitest";
import { shortText } from "../../../src/fields/short-text.js";

const field = { id: "customer_name", type: "short-text", label: "Customer name", required: true };

describe("shortText field", () => {
  it("renders a labeled text input", () => {
    const wrapper = shortText.render(field, null);
    const input = wrapper.querySelector("input[type=text]");
    expect(input).not.toBeNull();
    expect(input.id).toBe("customer_name");
    expect(wrapper.querySelector("label").textContent).toContain("Customer name");
  });

  it("pre-fills the given value", () => {
    const wrapper = shortText.render(field, "Acme Ltd");
    expect(shortText.getValue(wrapper)).toBe("Acme Ltd");
  });

  it("getValue/setValue round-trip", () => {
    const wrapper = shortText.render(field, null);
    shortText.setValue(wrapper, "New value");
    expect(shortText.getValue(wrapper)).toBe("New value");
  });

  it("setValue clears with null", () => {
    const wrapper = shortText.render(field, "something");
    shortText.setValue(wrapper, null);
    expect(shortText.getValue(wrapper)).toBe("");
  });

  it("validate fails when required and empty", () => {
    expect(shortText.validate(field, "")).not.toBe(true);
    expect(shortText.validate(field, "   ")).not.toBe(true);
  });

  it("validate passes when required and filled", () => {
    expect(shortText.validate(field, "Acme")).toBe(true);
  });

  it("validate passes when not required and empty", () => {
    const optional = { ...field, required: false };
    expect(shortText.validate(optional, "")).toBe(true);
  });
});
