import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

export const shortText = {
  render(field, value) {
    const input = document.createElement("input");
    input.type = "text";
    applyCommonInputAttrs(input, field);
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
      return "This field is required.";
    }
    return true;
  },
};
