import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { slugify } from "../core/id-generator.js";

/**
 * Re-reads every checkbox's checked state and: updates the "X of N done"
 * count, and — when the wrapper's sequential-lock flag is on — disables
 * (and un-checks, so a locked item can never sit checked) every item whose
 * predecessor isn't checked yet. Called after render, after every checkbox
 * change, and after reset/setValue, so this is the single source of truth
 * for the list's enabled/checked state rather than something re-derived ad
 * hoc. Reads the lock flag off `wrapper.dataset` (set once at render time)
 * rather than taking `field` as a parameter, since setValue() is called
 * generically with just (wrapper, value) everywhere else in this app.
 */
function syncChecklistState(wrapper) {
  const boxes = [...wrapper.querySelectorAll(".wb-checklist-item input[type=checkbox]")];
  if (wrapper.dataset.sequentialLock === "true") {
    boxes.forEach((box, index) => {
      const locked = index > 0 && !boxes[index - 1].checked;
      box.disabled = locked;
      if (locked && box.checked) box.checked = false;
    });
  }
  const progress = wrapper.querySelector(".wb-checklist-progress");
  if (progress) {
    const done = boxes.filter((box) => box.checked).length;
    progress.textContent = `${done} of ${boxes.length} done`;
  }
}

export const checklist = {
  render(field, value) {
    const checked = new Set(Array.isArray(value) ? value : []);
    const wrapper = createWrapper(field);
    wrapper.dataset.sequentialLock = field.sequentialLock ? "true" : "false";
    wrapper.appendChild(createLabel(field, null));

    const progress = document.createElement("div");
    progress.className = "wb-checklist-progress";
    wrapper.appendChild(progress);

    const list = document.createElement("div");
    list.className = "wb-checklist";

    (field.options || []).forEach((item, index) => {
      const itemId = `${field.id}--${slugify(item)}-${index}`;
      const row = document.createElement("div");
      row.className = "wb-checklist-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = itemId;
      input.name = field.id;
      input.value = item;
      input.checked = checked.has(item);

      const label = document.createElement("label");
      label.setAttribute("for", itemId);
      label.textContent = item;

      row.appendChild(input);
      row.appendChild(label);
      list.appendChild(row);
    });

    wrapper.appendChild(list);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "wb-checklist-reset";
    resetBtn.textContent = "Reset checklist";
    resetBtn.addEventListener("click", () => {
      list.querySelectorAll("input[type=checkbox]").forEach((box) => (box.checked = false));
      syncChecklistState(wrapper);
      wrapper.dispatchEvent(new Event("change", { bubbles: true }));
    });
    wrapper.appendChild(resetBtn);

    list.addEventListener("change", () => syncChecklistState(wrapper));
    syncChecklistState(wrapper);

    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    return [...wrapper.querySelectorAll(".wb-checklist-item input[type=checkbox]:checked")].map((el) => el.value);
  },
  setValue(wrapper, value) {
    const checked = new Set(Array.isArray(value) ? value : []);
    wrapper.querySelectorAll(".wb-checklist-item input[type=checkbox]").forEach((input) => {
      input.checked = checked.has(input.value);
    });
    syncChecklistState(wrapper);
  },
  validate(field, value) {
    if (field.required && (!Array.isArray(value) || value.length === 0)) {
      return "Please check at least one item.";
    }
    return true;
  },
};
