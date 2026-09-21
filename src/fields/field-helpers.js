/**
 * Shared DOM helpers used by every field module so each one only has to
 * describe its input element, not the wrapper/label/error boilerplate.
 */

export function createWrapper(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "wb-field";
  wrapper.dataset.fieldId = field.id;
  wrapper.dataset.fieldType = field.type;
  return wrapper;
}

export function createLabel(field, forId) {
  const label = document.createElement("label");
  label.className = "wb-field-label";
  label.textContent = field.label || "";
  if (forId) label.setAttribute("for", forId);
  if (field.required) {
    const marker = document.createElement("span");
    marker.className = "wb-required-marker";
    marker.textContent = "*";
    label.appendChild(document.createTextNode(" "));
    label.appendChild(marker);
  }
  return label;
}

export function createErrorSlot(field) {
  const slot = document.createElement("div");
  slot.className = "wb-field-error";
  slot.dataset.fieldError = field.id;
  slot.hidden = true;
  return slot;
}

export function applyCommonInputAttrs(input, field) {
  input.id = field.id;
  input.name = field.id;
  if (field.required) input.required = true;
  if (field.placeholder) input.placeholder = field.placeholder;
}

export function buildSimpleWrapper(field, inputEl) {
  const wrapper = createWrapper(field);
  wrapper.appendChild(createLabel(field, field.id));
  wrapper.appendChild(inputEl);
  wrapper.appendChild(createErrorSlot(field));
  return wrapper;
}

export function getInputEl(wrapper) {
  return wrapper.querySelector("input, textarea, select");
}
