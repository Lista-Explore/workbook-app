import { renderFieldEditor } from "./field-editor.js";

/**
 * `onChange` triggers a full rebuild (used for anything that adds/removes
 * a section or field, or otherwise changes what's on screen). `onLightChange`
 * only refreshes the preview/PDF mapping/autosave — used for plain text
 * typing (titles, image fields, labels, option text) so the input the
 * designer is actively typing into never gets rebuilt out from under them.
 */
export function renderSectionEditor(container, state, worksheetId, onChange, onLightChange) {
  container.innerHTML = "";
  const worksheet = state.workbook.worksheets.find((w) => w.id === worksheetId);
  if (!worksheet) return;

  worksheet.sections.forEach((section) => {
    const card = document.createElement("div");
    card.className = "builder-section-card";
    card.dataset.sectionId = section.id;

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "builder-section-title-input";
    titleInput.placeholder = "Section title";
    titleInput.value = section.title || "";
    titleInput.addEventListener("input", () => {
      state.updateSection(worksheetId, section.id, { title: titleInput.value });
      onLightChange();
    });

    const columnsLabel = document.createElement("label");
    columnsLabel.textContent = "Columns";
    const columnsSelect = document.createElement("select");
    [1, 2, 3].forEach((n) => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      columnsSelect.appendChild(opt);
    });
    columnsSelect.value = String(section.columns || 1);
    columnsSelect.addEventListener("change", () => {
      state.updateSection(worksheetId, section.id, { columns: Number(columnsSelect.value) });
      onChange(); // structural: the editor's own field list re-lays-out into N columns
    });
    columnsLabel.appendChild(columnsSelect);

    const collapsibleLabel = document.createElement("label");
    const collapsibleCheckbox = document.createElement("input");
    collapsibleCheckbox.type = "checkbox";
    collapsibleCheckbox.checked = Boolean(section.collapsible);
    collapsibleCheckbox.addEventListener("change", () => {
      state.updateSection(worksheetId, section.id, { collapsible: collapsibleCheckbox.checked });
      onChange(); // structural: reveals/hides the "starts collapsed" control
    });
    collapsibleLabel.appendChild(collapsibleCheckbox);
    collapsibleLabel.appendChild(document.createTextNode(" Student can collapse this section"));

    const startCollapsedLabel = document.createElement("label");
    const startCollapsedCheckbox = document.createElement("input");
    startCollapsedCheckbox.type = "checkbox";
    startCollapsedCheckbox.checked = Boolean(section.startCollapsed);
    startCollapsedCheckbox.addEventListener("change", () => {
      state.updateSection(worksheetId, section.id, { startCollapsed: startCollapsedCheckbox.checked });
      onLightChange();
    });
    startCollapsedLabel.appendChild(startCollapsedCheckbox);
    startCollapsedLabel.appendChild(document.createTextNode(" Starts collapsed"));

    const removeSectionBtn = document.createElement("button");
    removeSectionBtn.type = "button";
    removeSectionBtn.className = "builder-remove-btn";
    removeSectionBtn.textContent = "Remove section";
    removeSectionBtn.addEventListener("click", () => {
      state.removeSection(worksheetId, section.id);
      onChange();
    });

    const fieldsContainer = document.createElement("div");
    fieldsContainer.className = "builder-fields-container";
    renderFieldEditor(fieldsContainer, state, worksheetId, section.id, section, onChange, onLightChange);

    card.appendChild(titleInput);
    card.appendChild(columnsLabel);
    card.appendChild(collapsibleLabel);
    if (section.collapsible) card.appendChild(startCollapsedLabel);
    card.appendChild(fieldsContainer);
    card.appendChild(removeSectionBtn);

    container.appendChild(card);
  });

  const addSectionBtn = document.createElement("button");
  addSectionBtn.type = "button";
  addSectionBtn.className = "builder-add-section-btn";
  addSectionBtn.textContent = "+ Add section";
  addSectionBtn.addEventListener("click", () => {
    state.addSection(worksheetId, { title: "New section" });
    onChange();
  });
  container.appendChild(addSectionBtn);
}
