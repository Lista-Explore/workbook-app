import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { sanitizeContent } from "./content.js";
import { slugify } from "../core/id-generator.js";

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
      label.className = "wb-checklist-item-label";
      label.setAttribute("for", itemId);
      if (field.optionsHtml?.[index]) label.innerHTML = sanitizeContent(field.optionsHtml[index]);
      else label.textContent = item;

      row.appendChild(input);
      row.appendChild(label);
      list.appendChild(row);
    });

    wrapper.appendChild(list);

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
