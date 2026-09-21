import { createWrapper } from "./field-helpers.js";

// Display-only: a heading within a section. No student input, no stored value.
export const heading = {
  render(field) {
    const wrapper = createWrapper(field);
    const el = document.createElement("h3");
    el.className = "wb-heading";
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
