import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

// Free-text input with suggested options via a native <datalist>.
export const datalist = {
  render(field, value) {
    const input = document.createElement("input");
    input.type = "text";
    applyCommonInputAttrs(input, field);
    const listId = `${field.id}--options`;
    input.setAttribute("list", listId);
    if (value != null) input.value = value;

    const list = document.createElement("datalist");
    list.id = listId;
    for (const option of field.options || []) {
      const opt = document.createElement("option");
      opt.value = option;
      list.appendChild(opt);
    }

    const wrapper = buildSimpleWrapper(field, input);
    wrapper.appendChild(list);
    return wrapper;
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
