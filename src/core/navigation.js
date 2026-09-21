/**
 * Renders worksheet tabs and wires up switching. Each tab carries an explicit
 * data-workbook-tab-index so switching never depends on DOM position — any
 * number of worksheets works the same way.
 */
export function renderTabs(worksheets, { activeIndex = 0, onSelect } = {}) {
  const nav = document.createElement("div");
  nav.className = "wb-tabs";
  nav.setAttribute("role", "tablist");

  worksheets.forEach((worksheet, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "wb-tab";
    tab.textContent = worksheet.title || `Worksheet ${index + 1}`;
    tab.dataset.workbookTabIndex = String(index);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === activeIndex));
    tab.addEventListener("click", () => {
      selectTab(nav, index);
      if (onSelect) onSelect(index);
    });
    nav.appendChild(tab);
  });

  return nav;
}

export function selectTab(nav, index) {
  nav.querySelectorAll(".wb-tab").forEach((tab) => {
    const isActive = Number(tab.dataset.workbookTabIndex) === index;
    tab.setAttribute("aria-selected", String(isActive));
    tab.classList.toggle("wb-tab-active", isActive);
  });
}

export function showWorksheetPanel(panels, index) {
  panels.forEach((panel) => {
    const panelIndex = Number(panel.dataset.workbookPanelIndex);
    panel.hidden = panelIndex !== index;
  });
}
