import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

/**
 * Builds a field module for any field type that is just a single native
 * <input type="..."> with a label, optional required validation, and a
 * plain string/number value.
 */
export function makeSimpleInputField(htmlType, { validate } = {}) {
  return {
    render(field, value) {
      const input = document.createElement("input");
      input.type = htmlType;
      applyCommonInputAttrs(input, field);
      if (field.min != null) input.min = field.min;
      if (field.max != null) input.max = field.max;
      if (field.step != null) input.step = field.step;
      if (value != null) input.value = value;
      return buildSimpleWrapper(field, input);
    },
    getValue(wrapper) {
      return getInputEl(wrapper).value;
    },
    setValue(wrapper, value) {
      getInputEl(wrapper).value = value == null ? "" : value;
    },
    validate:
      validate ||
      ((field, value) => {
        if (field.required && !String(value || "").trim()) {
          return "This field is required.";
        }
        return true;
      }),
  };
}
