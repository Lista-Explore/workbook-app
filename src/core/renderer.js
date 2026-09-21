import { renderSection } from "../sections/section-renderer.js";
import { renderTabs, selectTab, showWorksheetPanel } from "./navigation.js";

/**
 * Renders a full workbook (title, worksheet tabs, and one panel per worksheet
 * containing its sections/fields) into `mountEl`.
 *
 * `data` is the current worksheet-data object: { worksheets: { worksheetId: { fieldId: value } } }.
 * `onFieldChange(worksheetId, fieldId, value)` is called on every field edit.
 *
 * Returns a handle: { root, tabsEl, panels, showWorksheet(index) }.
 */
export function renderWorkbook(config, mountEl, { data = {}, onFieldChange } = {}) {
  mountEl.innerHTML = "";
  mountEl.classList.add("lms-workbook");

  const root = document.createElement("div");
  root.className = "wb-root";

  if (config.title) {
    const title = document.createElement("h1");
    title.className = "wb-title";
    title.textContent = config.title;
    root.appendChild(title);
  }

  const worksheetsData = data.worksheets || {};
  const worksheets = config.worksheets || [];

  const tabsEl = renderTabs(worksheets, {
    activeIndex: 0,
    onSelect: (index) => showWorksheetPanel(panels, index),
  });
  if (worksheets.length > 1) {
    root.appendChild(tabsEl);
  }

  const panels = [];
  worksheets.forEach((worksheet, index) => {
    const panel = document.createElement("div");
    panel.className = "wb-worksheet-panel";
    panel.dataset.workbookPanelIndex = String(index);
    panel.hidden = index !== 0;

    const wsValues = worksheetsData[worksheet.id] || {};
    for (const section of worksheet.sections || []) {
      const sectionEl = renderSection(section, {
        values: wsValues,
        onFieldChange: onFieldChange
          ? (fieldId, value) => onFieldChange(worksheet.id, fieldId, value)
          : undefined,
      });
      panel.appendChild(sectionEl);
    }

    panels.push(panel);
    root.appendChild(panel);
  });

  mountEl.appendChild(root);

  return {
    root,
    tabsEl,
    panels,
    showWorksheet(index) {
      selectTab(tabsEl, index);
      showWorksheetPanel(panels, index);
    },
  };
}
