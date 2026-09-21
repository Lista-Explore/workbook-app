import { FieldRegistry } from "../fields/registry.js";
import { createWorkbookStorage } from "./storage.js";
import { renderWorkbookControls } from "./controls.js";
import { exportWorkbookPdf } from "../pdf/pdf-export.js";
import { importWorkbookPdf } from "../pdf/pdf-import.js";
import { domToConfig } from "./dom-config.js";

const AUTOSAVE_DELAY_MS = 400;

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Every stateful field wrapper already on the page, keyed by field id. */
function fieldWrappers(rootEl) {
  return Array.from(rootEl.querySelectorAll(".wb-field[data-field-id][data-field-type]"));
}

/**
 * The worksheet id a field wrapper belongs to — `worksheet-${index}`,
 * matching exactly how domToConfig() ids worksheets (by their position
 * among `.wb-worksheet-panel` elements). Values must be stored under this
 * same key, or exportWorkbookPdf()/importWorkbookPdf() — which look values
 * up by `worksheet.id` — silently find nothing and export a blank PDF.
 */
function worksheetIdFor(rootEl, wrapper) {
  const panel = wrapper.closest(".wb-worksheet-panel");
  const panels = Array.from(rootEl.querySelectorAll(".wb-worksheet-panel"));
  const index = panel ? panels.indexOf(panel) : 0;
  return `worksheet-${Math.max(index, 0)}`;
}

/**
 * Adds real behavior to an already-rendered `.lms-workbook` element: restores
 * previously saved answers, autosaves on every change, and appends the
 * download/upload/reset controls — all driven by reading the DOM itself
 * (via domToConfig), not by any embedded data. This is what lets the
 * Builder's "Workbook HTML" output be plain, readable markup with no JSON,
 * while still being fully interactive once this script runs.
 */
export async function hydrateWorkbook(rootEl) {
  const config = domToConfig(rootEl);
  if (!config.id) return null;

  const storage = createWorkbookStorage(config.id);
  const saved = (await storage.get("state")) || { worksheets: {} };
  const data = saved.worksheets ? saved : { worksheets: {} };

  function valueFor(fieldId) {
    for (const wsValues of Object.values(data.worksheets)) {
      if (wsValues && Object.prototype.hasOwnProperty.call(wsValues, fieldId)) return wsValues[fieldId];
    }
    return undefined;
  }

  function setFieldValue(worksheetId, fieldId, value) {
    if (!data.worksheets[worksheetId]) data.worksheets[worksheetId] = {};
    data.worksheets[worksheetId][fieldId] = value;
  }

  // Migrate any value found under the wrong worksheet key (e.g. saved by
  // an older version of this file, before worksheet ids were tracked
  // correctly) into the right key — otherwise it displays fine here (this
  // scan checks every key) but silently vanishes from exportWorkbookPdf(),
  // which only looks under the field's actual worksheet id.
  let migrated = false;
  const wrappers = fieldWrappers(rootEl);
  for (const wrapper of wrappers) {
    const type = wrapper.dataset.fieldType;
    if (!FieldRegistry.has(type)) continue;
    const field = FieldRegistry.get(type);
    const fieldId = wrapper.dataset.fieldId;
    const existing = valueFor(fieldId);
    if (existing !== undefined) {
      field.setValue(wrapper, existing);
      const correctWorksheetId = worksheetIdFor(rootEl, wrapper);
      if (!data.worksheets[correctWorksheetId]?.[fieldId]) {
        setFieldValue(correctWorksheetId, fieldId, existing);
        migrated = true;
      }
    }
  }

  const persist = debounce(() => storage.set("state", data), AUTOSAVE_DELAY_MS);
  if (migrated) persist();

  rootEl.addEventListener("input", (event) => {
    const wrapper = event.target.closest(".wb-field[data-field-id][data-field-type]");
    if (!wrapper) return;
    const type = wrapper.dataset.fieldType;
    if (!FieldRegistry.has(type)) return;
    const field = FieldRegistry.get(type);
    setFieldValue(worksheetIdFor(rootEl, wrapper), wrapper.dataset.fieldId, field.getValue(wrapper));
    persist();
  });
  rootEl.addEventListener("change", (event) => {
    const wrapper = event.target.closest(".wb-field[data-field-id][data-field-type]");
    if (!wrapper) return;
    const type = wrapper.dataset.fieldType;
    if (!FieldRegistry.has(type)) return;
    const field = FieldRegistry.get(type);
    setFieldValue(worksheetIdFor(rootEl, wrapper), wrapper.dataset.fieldId, field.getValue(wrapper));
    persist();
  });

  const adapter = {
    config,
    async exportPDF() {
      return exportWorkbookPdf(config, data);
    },
    async importPDF(pdfBytes) {
      const result = await importWorkbookPdf(config, pdfBytes, data);
      data.worksheets = result.data.worksheets;
      for (const wrapper of fieldWrappers(rootEl)) {
        const type = wrapper.dataset.fieldType;
        if (!FieldRegistry.has(type)) continue;
        const field = FieldRegistry.get(type);
        const value = valueFor(wrapper.dataset.fieldId);
        if (value !== undefined) field.setValue(wrapper, value);
      }
      await storage.set("state", data);
    },
    async clear() {
      data.worksheets = {};
      for (const wrapper of fieldWrappers(rootEl)) {
        const type = wrapper.dataset.fieldType;
        if (!FieldRegistry.has(type)) continue;
        FieldRegistry.get(type).setValue(wrapper, undefined);
      }
      await storage.delete("state");
    },
  };

  rootEl.appendChild(renderWorkbookControls(adapter));
  return adapter;
}

/**
 * Hydrates every `.lms-workbook` element on the page. Doesn't require
 * `data-workbook` on the element — some page editors strip attributes they
 * don't recognize, and domToConfig() already falls back to the title in
 * that case. A failure hydrating one workbook is logged and skipped rather
 * than aborting the rest of the page.
 */
export async function hydrateAllWorkbooks(root = document) {
  const roots = root.querySelectorAll(".lms-workbook");
  const results = [];
  for (const el of roots) {
    try {
      results.push(await hydrateWorkbook(el));
    } catch (err) {
      console.error("Failed to hydrate a workbook:", err);
      results.push(null);
    }
  }
  return results;
}
