import { createPreviewStorage } from "../../../src/core/storage.js";
import { exportWorkbookPdf } from "../../../src/pdf/pdf-export.js";
import { renderWorkbook } from "../../../src/core/renderer.js";
import { registerAllFields } from "../../../src/fields/index.js";

registerAllFields();

// The loader this points at (src/auto-mount.js) is deliberately trivial
// and self-refreshing: it injects the real stylesheet + bundled runtime
// with a fresh cache-busting timestamp on every page load, so once this
// one line is pasted, it never needs to be pasted again — future fixes to
// any part of the runtime just work, without fighting jsDelivr's 7-day
// browser cache. RUNTIME_VERSION only needs bumping again if this loader
// file's own logic ever has to change.
const RUNTIME_VERSION = "6";
const RUNTIME_LOADER_URL = `https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@main/src/auto-mount.js?v=${RUNTIME_VERSION}`;

/**
 * The one-time setup every LMS page with a workbook on it needs — a single
 * line, pointing at the loader on jsDelivr's CDN.
 */
export function setupSnippet() {
  return `<script type="module" src="${RUNTIME_LOADER_URL}"></script>`;
}

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
 * inputs, textareas, the image), no JSON, no data payload. The one-time
 * setup script reads this exact markup to add autosave/PDF/reset behavior.
 * Paste this directly into the LMS page and the form is already there.
 */
export function workbookHtml(config) {
  const container = document.createElement("div");
  container.dataset.workbook = config.id;
  renderWorkbook(config, container);
  return formatNode(container, 0);
}

/**
 * Shows the designer the one-time CDN setup, the workbook's own HTML —
 * both update live as they edit, nothing to click to save or "publish"
 * first — plus a fillable PDF to download.
 */
export function renderPublishPanel(container, state, { onStatus } = {}) {
  container.innerHTML = "";

  const setupLabel = document.createElement("label");
  setupLabel.className = "builder-setup-label";
  setupLabel.textContent = "One-time setup — paste this once on any LMS page that has a workbook on it:";
  const setupBox = document.createElement("textarea");
  setupBox.id = "builder-setup-snippet";
  setupBox.readOnly = true;
  setupBox.value = setupSnippet();
  setupLabel.appendChild(setupBox);

  const htmlLabel = document.createElement("label");
  htmlLabel.className = "builder-setup-label";
  const htmlBox = document.createElement("textarea");
  htmlBox.id = "builder-workbook-html";
  htmlBox.readOnly = true;
  const config = state.toConfig();
  if (config.id) {
    htmlLabel.textContent = "Workbook HTML — paste this wherever it should appear:";
    htmlBox.value = workbookHtml(config);
  } else {
    htmlLabel.textContent = "Workbook HTML — give the workbook a title above to generate it:";
    htmlBox.value = "";
  }
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

  container.appendChild(setupLabel);
  container.appendChild(htmlLabel);
  container.appendChild(downloadPdfBtn);
}
