import { createWrapper, createErrorSlot } from "./field-helpers.js";

// A single yes/no checkbox — the label sits beside the box, not above it.
export const checkbox = {
  render(field, value) {
    const wrapper = createWrapper(field);

    const row = document.createElement("div");
    row.className = "wb-checkbox-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = field.id;
    input.name = field.id;
    input.checked = Boolean(value);

    const label = document.createElement("label");
    label.setAttribute("for", field.id);
    label.textContent = field.label || "";
    if (field.required) {
      label.appendChild(document.createTextNode(" *"));
    }

    row.appendChild(input);
    row.appendChild(label);
    wrapper.appendChild(row);
    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    return wrapper.querySelector("input[type=checkbox]").checked;
  },
  setValue(wrapper, value) {
    wrapper.querySelector("input[type=checkbox]").checked = Boolean(value);
  },
  validate(field, value) {
    if (field.required && !value) {
      return "This must be checked.";
    }
    return true;
  },
};
