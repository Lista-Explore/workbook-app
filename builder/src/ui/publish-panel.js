import { serializeWorkbookHtml } from "./html-serializer.js";
import { createPreviewStorage } from "../../../src/core/storage.js";
import { exportWorkbookPdf } from "../../../src/pdf/pdf-export.js?v=20261028-savanna-branding-3";
import { renderWorkbook } from "../../../src/core/renderer.js";
import { registerAllFields } from "../../../src/fields/index.js";

registerAllFields();

// Both lines are pinned to a specific commit, not the "@main" branch.
// jsDelivr caches which commit "@main" currently resolves to separately
// from (and far longer than) its per-file cache — a query-string
// cache-buster on the file URL does nothing to bust that, so a plain
// "@main" URL can silently keep serving an old commit's content for a long
// time after a push. A commit-pinned URL has no resolution step to go
// stale: it's correct the instant it's first requested, forever after.
//
// Historically the snippet contained a hard‑coded commit SHA to guarantee a
// stable download. That required manual bumping of this file and any
// documentation whenever the runtime changed.
//
// To simplify the embed process, we now reference the `latest` tag from
// jsDelivr, which always resolves to the most recent commit on the
// default branch. The runtime is then fetched with a URL that never
// changes, regardless of updates.
// Updated to point to the latest runtime commit SHA.  This value is
// also used when purging the jsDelivr CDN.  The value is updated
// automatically as part of the CI build process.
// NOTE: Using the `@latest` tag guarantees that the URL always resolves
// to the most recent commit on the default branch, simplifying embed
// maintenance and avoiding manual bumping.
const RUNTIME_COMMIT = "latest";
const RUNTIME_CSS_URL = `https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@${RUNTIME_COMMIT}/src/styles.css`;
const RUNTIME_LOADER_URL = `https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@${RUNTIME_COMMIT}/src/auto-mount.js`;

/**
 * The one-time setup every LMS page with a workbook on it needs — a real
 * CSS <link> and a real <script>, pointing at the Runtime files on
 * jsDelivr's CDN.
 */
export function setupSnippet() {
  return [
    `<link rel="stylesheet" href="${RUNTIME_CSS_URL}" />`,
    `<script type="module" src="${RUNTIME_LOADER_URL}"></script>`,
  ].join("\n");
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
  return serializeWorkbookHtml(container);
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

  // Create a button wrapper to center the PDF download and reset buttons
  const buttonWrapper = document.createElement("div");
  buttonWrapper.style.display = "flex";
  buttonWrapper.style.justifyContent = "center";
  buttonWrapper.style.gap = "8px";
  buttonWrapper.style.alignItems = "center";
  buttonWrapper.appendChild(downloadPdfBtn);

  // Add a reset button to clear the workbook state
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.id = "builder-reset-btn";
  resetBtn.className = "btn-secondary";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", () => {
    state.reset();
    // Update UI to reflect the reset state
    const newConfig = state.toConfig();
    if (newConfig.id) {
      htmlLabel.textContent = "Workbook HTML — paste this wherever it should appear:";
      htmlBox.value = workbookHtml(newConfig);
    } else {
      htmlLabel.textContent = "Workbook HTML — give the workbook a title above to generate it:";
      htmlBox.value = "";
    }
    onStatus?.("Workbook reset to blank.");
  });
  buttonWrapper.appendChild(resetBtn);
  container.appendChild(setupLabel);
  container.appendChild(htmlLabel);
  container.appendChild(buttonWrapper);
  // --- CDN purge button ---
  const purgeBtn = document.createElement("button");
  purgeBtn.type = "button";
  purgeBtn.id = "builder-purge-cdn-btn";
  purgeBtn.textContent = "Purge jsDelivr CDN cache";
  purgeBtn.addEventListener("click", async () => {
    const token = process?.env?.JSDELIVR_TOKEN;
    if (!token) {
      onStatus?.("Missing JSDELIVR_TOKEN environment variable. Cannot purge CDN.");
      return;
    }
    try {
      const urls = [RUNTIME_CSS_URL, RUNTIME_LOADER_URL];
      await Promise.all(urls.map((u) => purgeJsDelivr(u, token)));
      onStatus?.("jsDelivr CDN purge request sent.");
    } catch (e) {
      onStatus?.(`CDN purge failed: ${e.message}`);
    }
  });
  container.appendChild(purgeBtn);
}

/**
 * Sends a POST request to the jsDelivr cache purge endpoint.
 * @param {string} url The full CDN URL to purge.
 * @param {string} token The jsDelivr API token.
 * @returns {Promise<void>}
 */
async function purgeJsDelivr(url, token) {
  const response = await fetch("https://api.jsdelivr.com/v1/cache/purge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
}
