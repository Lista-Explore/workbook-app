import { describe, it, expect } from "vitest";
import { signature } from "../../../src/fields/signature.js";

const field = { id: "sig", type: "signature", label: "Signature", required: true };

describe("signature field", () => {
  it("renders a text input marked as a signature", () => {
    const wrapper = signature.render(field, null);
    const input = wrapper.querySelector("input.wb-signature-input");
    expect(input).not.toBeNull();
  });

  it("round-trips a typed signature", () => {
    const wrapper = signature.render(field, null);
    signature.setValue(wrapper, "J. Smith");
    expect(signature.getValue(wrapper)).toBe("J. Smith");
  });

  it("required validation", () => {
    expect(signature.validate(field, "")).not.toBe(true);
    expect(signature.validate(field, "J. Smith")).toBe(true);
  });
});
