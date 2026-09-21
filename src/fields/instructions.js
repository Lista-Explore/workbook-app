import { createWrapper } from "./field-helpers.js";

// Display-only: instructional/explanatory text within a section.
export const instructions = {
  render(field) {
    const wrapper = createWrapper(field);
    const el = document.createElement("p");
    el.className = "wb-instructions";
    el.textContent = field.label || "";
    wrapper.appendChild(el);
    return wrapper;
  },
  getValue() {
    return undefined;
  },
  setValue() {
    // display-only, nothing to set
  },
  validate() {
    return true;
  },
};
