import { createPreviewStorage } from "../../../src/core/storage.js";
import { exportWorkbookPdf } from "../../../src/pdf/pdf-export.js";
import { renderWorkbook } from "../../../src/core/renderer.js";
import { registerAllFields } from "../../../src/fields/index.js";

registerAllFields();

const VOID_ELEMENTS = new Set(["img", "input", "br", "hr"]);

function formatAttributes(el) {
  return Array.from(el.attributes)
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .join("");
}

/** Recursively pretty-prints a DOM node — indented, one tag per line. */
function formatNode(node, depth) {
  const indent = "  ".repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    return text ? `${indent}${text}` : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  const open = `${indent}<${tag}${formatAttributes(node)}>`;
  if (VOID_ELEMENTS.has(tag)) return open;

  const children = Array.from(node.childNodes).filter(
    (child) => !(child.nodeType === Node.TEXT_NODE && !child.textContent.trim())
  );
  if (children.length === 0) return `${open}</${tag}>`;

  const hasElementChild = children.some((child) => child.nodeType === Node.ELEMENT_NODE);
  if (!hasElementChild) {
    return `${open}${node.textContent.trim()}</${tag}>`;
  }

  const inner = children
    .map((child) => formatNode(child, depth + 1))
    .filter(Boolean)
    .join("\n");
  return `${open}\n${inner}\n${indent}</${tag}>`;
}

/**
 * The actual HTML that renders the workbook — real form elements (labels,
 * inputs, textareas, the image), built the same way the Live Preview
 * builds them, and indented so it reads like normal, well-formatted code.
 * Paste this directly into the LMS page; it shows the form immediately, no
 * separate file, no script, nothing else required.
 */
export function workbookHtml(config) {
  const container = document.createElement("div");
  renderWorkbook(config, container);
  return formatNode(container, 0);
}

/**
 * Shows the designer the actual HTML for their workbook — updates live as
 * they edit, nothing to click to save or "publish" first — plus a fillable
 * PDF to download.
 */
export function renderPublishPanel(container, state, { onStatus } = {}) {
  container.innerHTML = "";

  const htmlLabel = document.createElement("label");
  htmlLabel.className = "builder-setup-label";
  htmlLabel.textContent = "Workbook HTML — paste this into your LMS page:";
  const htmlBox = document.createElement("textarea");
  htmlBox.id = "builder-workbook-html";
  htmlBox.readOnly = true;
  htmlBox.value = workbookHtml(state.toConfig());
  htmlLabel.appendChild(htmlBox);

  const downloadPdfBtn = document.createElement("button");
  downloadPdfBtn.type = "button";
  downloadPdfBtn.id = "builder-download-pdf-btn";
  downloadPdfBtn.textContent = "Download fillable PDF";

  downloadPdfBtn.addEventListener("click", async () => {
    const config = state.toConfig();
    if (!config.id) {
      onStatus?.("Give the workbook a title before downloading a PDF.");
      return;
    }

    // If the designer has been testing questions in the Preview popup,
    // include those answers — otherwise it's a blank fillable template.
    const previewState = await createPreviewStorage(config.id).get("state");
    const data = previewState || { worksheets: {} };

    const bytes = await exportWorkbookPdf(config, data);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    onStatus?.(`Downloaded "${config.id}.pdf".`);
  });

  container.appendChild(htmlLabel);
  container.appendChild(downloadPdfBtn);
}
