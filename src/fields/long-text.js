import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

export const longText = {
  render(field, value) {
    const textarea = document.createElement("textarea");
    applyCommonInputAttrs(textarea, field);
    textarea.rows = field.rows || 4;
    if (value != null) textarea.value = value;
    return buildSimpleWrapper(field, textarea);
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
