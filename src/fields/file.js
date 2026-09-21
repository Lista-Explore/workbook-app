import { buildSimpleWrapper, applyCommonInputAttrs, getInputEl } from "./field-helpers.js";

// Browsers cannot programmatically restore a File into an <input type="file">,
// so this field only stores the chosen file's name for display/record purposes;
// the actual file content is not persisted across sessions.
export const file = {
  render(field, value) {
    const input = document.createElement("input");
    input.type = "file";
    applyCommonInputAttrs(input, field);
    if (field.accept) input.accept = field.accept;
    const wrapper = buildSimpleWrapper(field, input);
    if (value) {
      const note = document.createElement("div");
      note.className = "wb-file-note";
      note.dataset.fileNote = field.id;
      note.textContent = `Previously selected: ${value}`;
      wrapper.appendChild(note);
    }
    return wrapper;
  },
  getValue(wrapper) {
    const input = getInputEl(wrapper);
    return input.files && input.files[0] ? input.files[0].name : null;
  },
  setValue() {
    // intentionally a no-op: cannot restore a file into a file input
  },
  validate(field, value) {
    if (field.required && !value) {
      return "Please choose a file.";
    }
    return true;
  },
};
