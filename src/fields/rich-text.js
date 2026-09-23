import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { sanitizeContent } from "./content.js";

const COMMANDS = [
  { label: "Bold", command: "bold", text: "B" },
  { label: "Italic", command: "italic", text: "I" },
  { label: "Underline", command: "underline", text: "U" },
  { label: "Bullets", command: "insertUnorderedList", text: "• List" },
  { label: "Numbered list", command: "insertOrderedList", text: "1. List" },
  { label: "Outdent", command: "outdent", text: "Outdent" },
  { label: "Indent", command: "indent", text: "Indent" },
];

const FORMATS = [
  ["P", "Paragraph"],
  ["H1", "Heading 1"],
  ["H2", "Heading 2"],
  ["H3", "Heading 3"],
  ["H4", "Heading 4"],
  ["H5", "Heading 5"],
  ["H6", "Heading 6"],
];

function normalizeHtml(html) {
  const clean = sanitizeContent(html || "").trim();
  return clean && clean !== "<p><br></p>" ? clean : "";
}

function dispatchInput(editor) {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyCommand(editor, command, value = null) {
  editor.focus();
  document.execCommand(command, false, value);
  dispatchInput(editor);
}

export const richText = {
  render(field, value) {
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field, field.id));

    const toolbar = document.createElement("div");
    toolbar.className = "wb-rich-text-toolbar";
    toolbar.setAttribute("aria-label", "Rich text formatting");

    const formatSelect = document.createElement("select");
    formatSelect.className = "wb-rich-text-format";
    formatSelect.setAttribute("aria-label", "Text format");
    FORMATS.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      formatSelect.appendChild(option);
    });
    formatSelect.addEventListener("change", () => applyCommand(editor, "formatBlock", formatSelect.value));
    toolbar.appendChild(formatSelect);

    COMMANDS.forEach(({ label, command, text }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wb-rich-text-btn";
      button.setAttribute("aria-label", label);
      button.textContent = text;
      button.addEventListener("click", () => applyCommand(editor, command));
      toolbar.appendChild(button);
    });

    const editor = document.createElement("div");
    editor.id = field.id;
    editor.className = "wb-rich-text-input";
    editor.contentEditable = "true";
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("aria-label", field.label || "Rich text response");
    editor.dataset.placeholder = field.placeholder || "";
    if (field.required) editor.setAttribute("aria-required", "true");
    editor.innerHTML = normalizeHtml(value) || "<p><br></p>";
    editor.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
      dispatchInput(editor);
    });
    editor.addEventListener("blur", () => {
      editor.innerHTML = normalizeHtml(editor.innerHTML) || "<p><br></p>";
      dispatchInput(editor);
    });

    wrapper.appendChild(toolbar);
    wrapper.appendChild(editor);
    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    const editor = wrapper.querySelector(".wb-rich-text-input");
    return normalizeHtml(editor?.innerHTML || "");
  },
  setValue(wrapper, value) {
    const editor = wrapper.querySelector(".wb-rich-text-input");
    if (editor) editor.innerHTML = normalizeHtml(value) || "<p><br></p>";
  },
  validate(field, value) {
    const host = document.createElement("div");
    host.innerHTML = normalizeHtml(value);
    if (field.required && !host.textContent.trim()) {
      return "This field is required.";
    }
    return true;
  },
};
