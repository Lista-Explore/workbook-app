import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { slugify } from "../core/id-generator.js";

export const checkboxGroup = {
  render(field, value) {
    const selected = new Set(Array.isArray(value) ? value : []);
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, null));

    const group = document.createElement("div");
    group.className = "wb-checkbox-group";

    (field.options || []).forEach((option, index) => {
      const optionId = `${field.id}--${slugify(option)}-${index}`;
      const optWrapper = document.createElement("div");
      optWrapper.className = "wb-checkbox-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = optionId;
      input.name = field.id;
      input.value = option;
      input.checked = selected.has(option);

      const optLabel = document.createElement("label");
      optLabel.setAttribute("for", optionId);
      optLabel.textContent = option;

      optWrapper.appendChild(input);
      optWrapper.appendChild(optLabel);
      group.appendChild(optWrapper);
    });

    wrapper.appendChild(group);
    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    return [...wrapper.querySelectorAll("input[type=checkbox]:checked")].map((el) => el.value);
  },
  setValue(wrapper, value) {
    const selected = new Set(Array.isArray(value) ? value : []);
    wrapper.querySelectorAll("input[type=checkbox]").forEach((input) => {
      input.checked = selected.has(input.value);
    });
  },
  validate(field, value) {
    if (field.required && (!Array.isArray(value) || value.length === 0)) {
      return "Please select at least one option.";
    }
    return true;
  },
};
