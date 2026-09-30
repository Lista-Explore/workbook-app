import { richText } from "../../../src/fields/rich-text.js";
import { contentText, repairContentHtmlSpacing } from "../../../src/fields/content.js";

// Keep a plain-text companion for navigation, accessibility and older exports.
export function renderTextEditor(model, key, className, name, onChange) {
  const escaped = document.createElement('div');
  escaped.textContent = model[key] || '';
  const field = richText.render({ id: `author-${crypto.randomUUID()}`, label: name }, model[`${key}Html`] || escaped.innerHTML);
  const wrapper = document.createElement('div');
  wrapper.classList.add('builder-text-editor');
  const toolbar = field.querySelector('.wb-rich-text-toolbar');
  const editor = field.querySelector('.wb-rich-text-input');
  wrapper.appendChild(toolbar);
  wrapper.appendChild(editor);
  editor.classList.add(className);
  editor.addEventListener('input', () => {
    const html = repairContentHtmlSpacing(editor.innerHTML);
    onChange({ [key]: contentText({ html }), [`${key}Html`]: html });
  });
  return wrapper;
}
