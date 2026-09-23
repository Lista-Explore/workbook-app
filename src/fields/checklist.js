import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { sanitizeContent } from "./content.js";
import { slugify } from "../core/id-generator.js";

/**
 * Re-reads every checkbox's checked state and: updates the "X of N done"
 * count, and disables (and un-checks, so a locked item can never sit
 * checked) any item whose prerequisite — read from its own
 * `data-depends-on` attribute (the *other* item's index, not necessarily
 * the one right before it) — isn't checked yet. Called after render,
 * after every checkbox change, and after reset/setValue, so this is the
 * single source of truth for the list's enabled/checked state rather than
 * something re-derived ad hoc.
 *
 * Exported so hydrate.js can re-wire this on a checklist that was already
 * static HTML when the page loaded (its own change listener, attached
 * below in render(), only exists on a checklist this module rendered
 * itself in this same page load — plain HTML serialization carries the
 * markup and the `data-depends-on` attributes, but never a JS closure).
 */
export function syncChecklistState(wrapper) {
  const boxes = [...wrapper.querySelectorAll(".wb-checklist-item input[type=checkbox]")];
  boxes.forEach((box) => {
    const dependsOn = box.dataset.dependsOn;
    if (dependsOn === undefined || dependsOn === "") return;
    const prerequisite = boxes[Number(dependsOn)];
    const locked = prerequisite ? !prerequisite.checked : false;
    box.disabled = locked;
    if (locked && box.checked) box.checked = false;
  });
  const progress = wrapper.querySelector(".wb-checklist-progress");
  if (progress) {
    const done = boxes.filter((box) => box.checked).length;
    progress.textContent = `${done} of ${boxes.length} done`;
    const meter = wrapper.querySelector('.wb-checklist-meter');
    if (meter) { meter.max = boxes.length || 1; meter.value = done; }
  }
}

export const checklist = {
  render(field, value) {
    const checked = new Set(Array.isArray(value) ? value : []);
    const dependsOn = field.dependsOn || [];
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, null));

    const progress = document.createElement("div");
    progress.className = "wb-checklist-progress";
    progress.setAttribute("aria-live", "polite");
    wrapper.appendChild(progress);
    const meter = document.createElement("progress");
    meter.className = "wb-checklist-meter";
    meter.setAttribute("aria-label", "Checklist progress");
    wrapper.appendChild(meter);

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
      if (Number.isInteger(dependsOn[index])) {
        input.dataset.dependsOn = String(dependsOn[index]);
      }

      const label = document.createElement("label");
      label.setAttribute("for", itemId);
      if (field.optionsHtml?.[index]) label.innerHTML = sanitizeContent(field.optionsHtml[index]);
      else label.textContent = item;

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
