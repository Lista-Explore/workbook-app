import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

// A typed signature: a text input semantically marked as a signature.
export const signature = {
  render(field, value) {
    const input = document.createElement("input");
    input.type = "text";
    applyCommonInputAttrs(input, field);
    input.classList.add("wb-signature-input");
    if (value != null) input.value = value;
    return buildSimpleWrapper(field, input);
  },
  getValue(wrapper) {
    return getInputEl(wrapper).value;
  },
  setValue(wrapper, value) {
    getInputEl(wrapper).value = value == null ? "" : value;
  },
  validate(field, value) {
    if (field.required && !String(value || "").trim()) {
      return "A signature is required.";
    }
    return true;
  },
};
