import { sanitizeContent } from "../../../src/fields/content.js";

const editors = new Set();
export function destroyContentEditors() {
  for (const { editor, observer } of editors) {
    observer.disconnect();
    editor.destroy();
  }
  editors.clear();
}

export function renderContentEditor(field, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-content-editor";
  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Content");
  wrap.append(textarea);
  // The field row is assembled off-DOM. SunEditor needs a connected host.
  queueMicrotask(() => {
    if (!wrap.isConnected) return;
    const editor = window.SUNEDITOR.create(textarea, {
      width: "100%",
      height: "260px",
      minHeight: "180px",
      stickyToolbar: -1,
      defaultStyle: "font-family: Arial; font-size: 16px;",
      fontSize: [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72],
      formats: ["p", "div", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre"],
      buttonList: [
        ["undo", "redo"],
        ["fontSize", "formatBlock"],
        ["bold", "italic", "underline", "strike", "subscript", "superscript"],
        ["fontColor", "hiliteColor", "textStyle", "removeFormat"],
        ["align", "list", "outdent", "indent", "lineHeight", "paragraphStyle", "blockquote"],
        ["table", "link", "image", "horizontalRule"],
        ["fullScreen", "showBlocks"],
      ],
      imageFileInput: false,
      imageUrlInput: true,
    });
    let lastHtml = "";
    const sync = (html = editor.getContents()) => {
      const clean = sanitizeContent(html);
      if (clean === lastHtml) return;
      lastHtml = clean;
      onChange(clean);
    };
    editor.setContents(sanitizeContent(field.html));
    lastHtml = sanitizeContent(editor.getContents());
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
  });
  return wrap;
}
