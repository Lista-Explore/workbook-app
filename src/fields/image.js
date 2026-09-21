import { createWrapper } from "./field-helpers.js";

// Display-only: an image within a section's flow, positioned wherever the
// designer inserted it among the other questions — not a fixed section-level
// slot. No student input, no stored value.
export const image = {
  render(field) {
    const wrapper = createWrapper(field);
    const figure = document.createElement("figure");
    figure.className = "wb-field-image";
    const img = document.createElement("img");
    img.src = field.src || "";
    img.alt = field.alt || "";
    figure.appendChild(img);
    if (field.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = field.caption;
      figure.appendChild(caption);
    }
    wrapper.appendChild(figure);
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
