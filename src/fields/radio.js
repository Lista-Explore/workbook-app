import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { slugify } from "../core/id-generator.js";

export const radio = {
  render(field, value) {
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, null));

    const group = document.createElement("div");
    group.className = "wb-radio-group";
    group.setAttribute("role", "radiogroup");

    (field.options || []).forEach((option, index) => {
      const optionId = `${field.id}--${slugify(option)}-${index}`;
      const optWrapper = document.createElement("div");
      optWrapper.className = "wb-radio-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = field.id;
      input.id = optionId;
      input.value = option;
      if (field.required) input.required = true;
      if (value === option) input.checked = true;

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
    const checked = wrapper.querySelector("input[type=radio]:checked");
    return checked ? checked.value : null;
  },
  setValue(wrapper, value) {
    wrapper.querySelectorAll("input[type=radio]").forEach((input) => {
      input.checked = input.value === value;
    });
  },
  validate(field, value) {
    if (field.required && !value) {
      return "Please select an option.";
    }
    return true;
  },
};
