import { richText } from "../../../src/fields/rich-text.js";
import { contentText } from "../../../src/fields/content.js";

// Keep a plain-text companion for navigation, accessibility and older exports.
export function renderTextEditor(model, key, className, name, onChange) {
  const escaped = document.createElement('div');
  escaped.textContent = model[key] || '';
  const wrapper = richText.render({ id: `author-${crypto.randomUUID()}`, label: name }, model[`${key}Html`] || escaped.innerHTML);
  wrapper.classList.add('builder-text-editor');
  const editor = wrapper.querySelector('.wb-rich-text-input');
  editor.classList.add(className);
  editor.addEventListener('input', () => {
    const html = richText.getValue(wrapper);
    onChange({ [key]: contentText({ html }), [`${key}Html`]: html });
  });
  return wrapper;
}
