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

const MIN_COLUMN_PERCENT = 5;
const RESIZE_EDGE_PX = 5;

// A row is resizable only if it's a plain grid row (no merged cells) and
// matches the column count of the table's reference row.
function plainRow(row) {
  return row && [...row.cells].every((cell) => cell.colSpan === 1 && cell.rowSpan === 1);
}

function referenceRow(table) {
  return [...table.rows].find(plainRow);
}

function resizeTarget(event, wysiwyg) {
  const cell = event.target.closest?.("td, th");
  if (!cell || !wysiwyg.contains(cell)) return null;
  const row = cell.parentElement;
  const table = row.closest("table");
  const reference = table && referenceRow(table);
  if (!reference || !plainRow(row) || row.cells.length !== reference.cells.length) return null;
  const index = cell.cellIndex;
  if (index >= row.cells.length - 1) return null;
  if (cell.getBoundingClientRect().right - event.clientX > RESIZE_EDGE_PX) return null;
  return { table, reference, index };
}

// Drag a column border in any table in the content editor to resize the two
// columns either side of it. Widths are written as percentages onto the
// cells, so they're saved with the content's HTML.
function enableTableColumnResize(wysiwyg) {
  wysiwyg.addEventListener("mousemove", (event) => {
    if (event.buttons) return;
    wysiwyg.style.cursor = resizeTarget(event, wysiwyg) ? "col-resize" : "";
  });
  wysiwyg.addEventListener("mousedown", (event) => {
    const target = resizeTarget(event, wysiwyg);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const { table, reference, index } = target;
    const tableWidth = table.getBoundingClientRect().width || 1;
    const widths = [...reference.cells].map((cell) => (cell.getBoundingClientRect().width / tableWidth) * 100);
    const startLeft = widths[index];
    const startRight = widths[index + 1];
    const startX = event.clientX;
    const rows = [...table.rows].filter((row) => plainRow(row) && row.cells.length === widths.length);
    table.style.tableLayout = "fixed";
    const apply = () => rows.forEach((row) => widths.forEach((width, i) => {
      row.cells[i].style.width = `${width.toFixed(2)}%`;
    }));
    apply();
    const onMove = (moveEvent) => {
      const delta = ((moveEvent.clientX - startX) / tableWidth) * 100;
      const shift = Math.min(Math.max(delta, MIN_COLUMN_PERCENT - startLeft), startRight - MIN_COLUMN_PERCENT);
      widths[index] = startLeft + shift;
      widths[index + 1] = startRight - shift;
      apply();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, true);
}

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
  enableTableColumnResize(editor.core.context.element.wysiwyg);
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
