import { createWrapper, createLabel, createErrorSlot, applyCommonInputAttrs } from "./field-helpers.js";

export const dropdown = {
  render(field, value) {
    const select = document.createElement("select");
    applyCommonInputAttrs(select, field);

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = field.placeholder || "Select...";
    select.appendChild(blank);

    for (const option of field.options || []) {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    }
    if (value != null) select.value = value;

    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, field.id));
    wrapper.appendChild(select);
    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    return wrapper.querySelector("select").value;
  },
  setValue(wrapper, value) {
    wrapper.querySelector("select").value = value == null ? "" : value;
  },
  validate(field, value) {
    if (field.required && !value) {
      return "Please select an option.";
    }
    return true;
  },
};
