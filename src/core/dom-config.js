import { slugify } from "./id-generator.js";

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

function fieldConfigFromWrapper(wrapper, column) {
  const id = wrapper.dataset.fieldId;
  const type = wrapper.dataset.fieldType;
  const { label, required } = fieldLabelAndRequired(wrapper, type);
  const base = { id, type, label, required, column };

  if (type === "radio" || type === "checkbox-group") {
    const options = Array.from(wrapper.querySelectorAll("input")).map((input) => {
      const optLabel = wrapper.querySelector(`label[for="${input.id}"]`);
      return optLabel ? optLabel.textContent.trim() : input.value;
    });
    return { ...base, options };
  }
  if (type === "checklist") {
    const inputs = Array.from(wrapper.querySelectorAll(".wb-checklist-item input"));
    const options = inputs.map((input) => {
      const optLabel = wrapper.querySelector(`label[for="${input.id}"]`);
      return optLabel ? optLabel.textContent.trim() : input.value;
    });
    const dependsOn = inputs.map((input) =>
      input.dataset.dependsOn !== undefined && input.dataset.dependsOn !== "" ? Number(input.dataset.dependsOn) : null
    );
    return { ...base, options, dependsOn };
  }
  if (type === "dropdown") {
    const options = Array.from(wrapper.querySelectorAll("select option"))
      .map((opt) => opt.value)
      .filter((value) => value !== "");
    return { ...base, options };
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
  const fieldsWrap = sectionEl.querySelector(".wb-section-fields");
  const columns = fieldsWrap ? Number(fieldsWrap.dataset.columns || 1) : 1;
  const columnEls = fieldsWrap ? Array.from(fieldsWrap.querySelectorAll(":scope > .wb-column")) : [];

  const fields = [];
  columnEls.forEach((colEl, columnIndex) => {
    Array.from(colEl.querySelectorAll(":scope > .wb-field")).forEach((wrapper) => {
      fields.push(fieldConfigFromWrapper(wrapper, columnIndex));
    });
  });

  return { id, title, columns, collapsible: sectionEl.tagName === "DETAILS", ...(sectionEl.dataset.unsectioned === "true" ? { unsectioned: true } : {}), fields };
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
