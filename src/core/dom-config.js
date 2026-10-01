import { sanitizeContent } from "../fields/content.js";
import { slugify } from "./id-generator.js";
import { FieldRegistry } from "../fields/registry.js";

/**
 * Reconstructs a workbook config object by reading the already-rendered
 * static HTML — the inverse of renderWorkbook(). This exists so the Runtime
 * can offer real functionality (autosave, PDF export/import) from plain,
 * readable HTML with no embedded JSON: everything the config needs is
 * already expressed as real markup (labels, input types, data-* attributes).
 */

function fieldLabelAndRequired(wrapper, type) {
  if (type === "checkbox") {
    const label = wrapper.querySelector(".wb-checkbox-row label");
    let text = label ? label.textContent.trim() : "";
    const required = text.endsWith("*");
    if (required) text = text.slice(0, -1).trim();
    return { label: text, required };
  }

  const labelEl = wrapper.querySelector(".wb-field-label");
  if (labelEl) {
    const required = !!labelEl.querySelector(".wb-required-marker");
    const text = Array.from(labelEl.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim();
    return { label: text, required };
  }

  const displayEl = wrapper.querySelector(".wb-heading, .wb-instructions, .wb-statement");
  return { label: displayEl ? displayEl.textContent.trim() : "", required: false };
}

function fieldConfigFromWrapper(wrapper, column, block) {
  const id = wrapper.dataset.fieldId;
  const type = wrapper.dataset.fieldType;
  const { label, required } = fieldLabelAndRequired(wrapper, type);
  const base = { id, type, label, required, column, ...(block ? { block } : {}) };

  if (type === "content") {
    return { ...base, html: sanitizeContent(wrapper.querySelector(".wb-content")?.innerHTML || "") };
  }
  if (type === "rich-text") {
    return base;
  }
  if (type === "radio" || type === "checkbox-group") {
    const options = Array.from(wrapper.querySelectorAll("input")).map((input) => {
      const optLabel = wrapper.querySelector(`label[for="${input.id}"]`);
      return optLabel ? optLabel.textContent.trim() : input.value;
    });
    return { ...base, options };
  }
  if (type === "checklist") {
    const inputs = Array.from(wrapper.querySelectorAll(".wb-checklist-item input"));
    const options = inputs.map((input) => input.value);
    const optionsHtml = inputs.map((input) => sanitizeContent(input.nextElementSibling?.innerHTML || ""));
    const dependsOn = inputs.map((input) =>
      input.dataset.dependsOn !== undefined && input.dataset.dependsOn !== "" ? Number(input.dataset.dependsOn) : null
    );
    return { ...base, options, optionsHtml, dependsOn };
  }
  if (type === "dropdown") {
    const options = Array.from(wrapper.querySelectorAll("select option"))
      .map((opt) => opt.value)
      .filter((value) => value !== "");
    return { ...base, options };
  }
  if (type === "table") {
    const tableEl = wrapper.querySelector(".wb-input-table");
    const common = {
      ...base,
      initialRows: wrapper.querySelectorAll(".wb-table-input-row").length || 1,
      allowAddRows: tableEl?.dataset.allowAddRows === "true",
      columnWidths: tableEl?.dataset.columnWidths ? JSON.parse(tableEl.dataset.columnWidths) : [],
    };
    if (tableEl?.dataset.cellGrid === "true") {
      const cells = Array.from(tableEl.querySelectorAll("tbody tr")).map((row, rowIndex) =>
        Array.from(row.children).map((cell, columnIndex) => ({
          id: cell.dataset.cellId || cell.dataset.columnId || `cell_${rowIndex + 1}_${columnIndex + 1}`,
          type: cell.dataset.cellType || (cell.tagName === "TH" ? "header" : "short-text"),
          content: cell.dataset.content || (cell.dataset.cellType === "dropdown" ? "" : cell.textContent.trim()) || "",
          options: cell.dataset.options ? JSON.parse(cell.dataset.options) : [],
        }))
      );
      return { ...common, cells };
    }
    const columns = Array.from(wrapper.querySelectorAll(".wb-input-table thead th")).map((th, index) => ({
      id: th.dataset.columnId || `column_${index + 1}`,
      label: th.textContent.trim() || `Column ${index + 1}`,
      type: th.dataset.cellType || "short-text",
      options: th.dataset.options ? JSON.parse(th.dataset.options) : [],
      content: th.dataset.content || "",
    }));
    return { ...common, columns };
  }
  if (type === "scale" || type === "scoreboard" || type === "scored-text") {
    // These carry their full config in data-* attributes, so the module that
    // renders them is also the one that reads them back.
    const { id: _id, type: _type, label: _label, required: _required, ...rest } = FieldRegistry.get(type).configFromWrapper(wrapper);
    return { ...base, ...rest };
  }
  if (type === "datalist") {
    const options = Array.from(wrapper.querySelectorAll("datalist option")).map((opt) => opt.value);
    return { ...base, options };
  }
  if (type === "image") {
    const img = wrapper.querySelector("img");
    const caption = wrapper.querySelector("figcaption");
    return {
      ...base,
      src: img ? img.getAttribute("src") || "" : "",
      alt: img ? img.getAttribute("alt") || "" : "",
      caption: caption ? caption.textContent.trim() : "",
    };
  }
  return base;
}

function sectionConfigFromEl(sectionEl) {
  const id = sectionEl.dataset.sectionId;
  const titleEl = sectionEl.querySelector(".wb-section-title");
  const title = titleEl ? titleEl.textContent.replace(/^[▾▸]\s*/, "").trim() : "";
  // A section can render more than one .wb-section-fields block — one per
  // layout block authored in the Builder (each with its own column count,
  // all under this one section's banner). Reading every block back here,
  // not just the first, is what keeps "Import LMS-HTML" round-tripping a
  // multi-layout section correctly instead of silently dropping the rest.
  const fieldsWraps = Array.from(sectionEl.querySelectorAll(":scope > .wb-section-fields"));
  const blockColumnCounts = fieldsWraps.map((wrap) => Number(wrap.dataset.columns || 1));
  const columns = blockColumnCounts[0] || 1;

  const fields = [];
  fieldsWraps.forEach((fieldsWrap, blockIndex) => {
    const columnEls = Array.from(fieldsWrap.querySelectorAll(":scope > .wb-column"));
    columnEls.forEach((colEl, columnIndex) => {
      Array.from(colEl.querySelectorAll(":scope > .wb-field")).forEach((wrapper) => {
        fields.push(fieldConfigFromWrapper(wrapper, columnIndex, blockIndex));
      });
    });
  });

  return {
    id,
    title,
    columns,
    collapsible: sectionEl.tagName === "DETAILS",
    ...(sectionEl.dataset.unsectioned === "true" ? { unsectioned: true } : {}),
    ...(blockColumnCounts.length > 1 ? { blocks: blockColumnCounts } : {}),
    fields,
  };
}

/** Reconstructs a full workbook config from a mounted `.lms-workbook` element. */
export function domToConfig(rootEl) {
  const titleEl = rootEl.querySelector(".wb-title");
  const title = titleEl ? titleEl.textContent.trim() : "";
  // Some page editors strip data-* attributes they don't recognize. Falling
  // back to the title keeps storage/PDF working even if data-workbook was
  // stripped — only a title-less, id-less workbook can't be identified.
  const id = rootEl.dataset.workbook || slugify(title);

  const tabs = Array.from(rootEl.querySelectorAll(".wb-tab"));
  const panels = Array.from(rootEl.querySelectorAll(".wb-worksheet-panel"));

  const worksheets = panels.map((panel, index) => {
    const tab = tabs[index];
    const worksheetTitle = tab ? tab.textContent.trim() : "";
    const sections = Array.from(panel.querySelectorAll(":scope > .wb-section")).map(sectionConfigFromEl);
    return { id: `worksheet-${index}`, title: worksheetTitle, sections };
  });

  return { id, title, worksheets };
}
