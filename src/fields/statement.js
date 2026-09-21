import { createWrapper } from "./field-helpers.js";

// Display-only: a standalone statement/callout within a section.
export const statement = {
  render(field) {
    const wrapper = createWrapper(field);
    const el = document.createElement("div");
    el.className = "wb-statement";
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
