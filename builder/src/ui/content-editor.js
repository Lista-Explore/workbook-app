import { repairContentHtmlSpacing, sanitizeContent } from "../../../src/fields/content.js";

const editors = new Set();
const EDITOR_BUTTONS = [
  ["undo", "redo"],
  ["fontSize", "formatBlock"],
  ["bold", "italic", "underline", "strike", "subscript", "superscript"],
  ["fontColor", "hiliteColor", "textStyle", "removeFormat"],
  ["align", "list", "outdent", "indent", "lineHeight", "paragraphStyle", "blockquote"],
  ["table", "link", "image", "horizontalRule"],
  ["fullScreen", "showBlocks"],
];

export function destroyContentEditors() {
  for (const { editor, observer } of editors) {
    observer.disconnect();
    editor.destroy();
  }
  editors.clear();
}

function createEditor(textarea, field, onChange, { height = "260px", minHeight = "180px" } = {}) {
  const editor = window.SUNEDITOR.create(textarea, {
    width: "100%",
    height,
    minHeight,
    stickyToolbar: -1,
    defaultStyle: "font-family: Arial; font-size: 16px;",
    fontSize: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72],
    formats: ["p", "div", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre"],
    buttonList: EDITOR_BUTTONS,
    imageFileInput: false,
    imageUrlInput: true,
  });
  let lastHtml = "";
  const sync = (html = editor.getContents()) => {
    const clean = repairContentHtmlSpacing(html);
    if (clean === lastHtml) return;
    lastHtml = clean;
    onChange(clean);
  };
  editor.setContents(repairContentHtmlSpacing(field.html));
  lastHtml = repairContentHtmlSpacing(editor.getContents());
  editor.onChange = sync;
  editor.core.context.element.wysiwyg.setAttribute("aria-label", "Content text");
  const observer = new MutationObserver(() => queueMicrotask(() => sync()));
  observer.observe(editor.core.context.element.wysiwyg, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  editors.add({ editor, observer });
  return { editor, observer, sync };
}

function destroyEditor(instance) {
  if (!instance) return;
  instance.observer.disconnect();
  instance.editor.destroy();
  editors.delete(instance);
}

function openExpandedEditor(field, onChange, onClose) {
  const dialog = document.createElement("dialog");
  dialog.className = "builder-content-expand-dialog";
  dialog.innerHTML = `
    <div class="builder-content-expand-header">
      <h2>Edit content</h2>
      <button type="button" class="builder-content-expand-close">Close</button>
    </div>
    <div class="builder-content-expand-body"></div>
  `;
  const body = dialog.querySelector(".builder-content-expand-body");
  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Expanded content");
  body.appendChild(textarea);
  document.body.appendChild(dialog);

  let instance = null;
  const close = () => dialog.close();
  dialog.querySelector(".builder-content-expand-close").addEventListener("click", close);
  dialog.addEventListener("close", () => {
    instance?.sync();
    const clean = instance ? repairContentHtmlSpacing(instance.editor.getContents()) : repairContentHtmlSpacing(field.html);
    destroyEditor(instance);
    dialog.remove();
    onClose?.(clean);
  });
  dialog.showModal();
  instance = createEditor(textarea, field, onChange, { height: "62vh", minHeight: "420px" });
}

export function renderContentEditor(field, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-content-editor";

  const toolbar = document.createElement("div");
  toolbar.className = "builder-content-editor-actions";
  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "builder-content-expand-btn";
  expandBtn.textContent = "Expand editor";
  let inlineInstance = null;
  expandBtn.addEventListener("click", () => openExpandedEditor(field, onChange, (html) => {
    if (!inlineInstance) return;
    inlineInstance.editor.setContents(repairContentHtmlSpacing(html));
    inlineInstance.sync();
  }));
  toolbar.appendChild(expandBtn);
  wrap.appendChild(toolbar);

  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Content");
  wrap.append(textarea);
  // The field row is assembled off-DOM. SunEditor needs a connected host.
  queueMicrotask(() => {
    if (!wrap.isConnected) return;
    inlineInstance = createEditor(textarea, field, onChange);
  });
  return wrap;
}
