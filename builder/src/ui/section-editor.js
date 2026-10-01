import { renderFieldEditor } from "./field-editor.js";


function renderColumnsControl(section, state, worksheetId, onChange, isNamedSection) {
  const columnsLabel = document.createElement("label");
  columnsLabel.className = "builder-columns-control";
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
    const columns = Number(columnsSelect.value);
    // A named section's control always edits layout block 0 — once extra
    // blocks exist (added via "+ Start new layout in this section"),
    // `updateSectionBlock` is what keeps `section.columns` mirroring block
    // 0 rather than drifting out of sync with it.
    if (isNamedSection) state.updateSectionBlock(worksheetId, section.id, 0, columns);
    else if (section.id) state.updateSection(worksheetId, section.id, { columns });
    else section.columns = columns;
    onChange();
  });
  columnsLabel.appendChild(columnsSelect);
  return columnsLabel;
}

function renderStandaloneLayoutButton(state, worksheetId, onChange, afterSectionId) {
  const addLayoutBtn = document.createElement("button");
  addLayoutBtn.type = "button";
  addLayoutBtn.className = "builder-add-standalone-layout-btn";
  addLayoutBtn.textContent = "+ Start new no-section layout";
  addLayoutBtn.addEventListener("click", () => {
    state.addStandaloneSection(worksheetId, { columns: 1, afterSectionId });
    onChange();
  });
  return addLayoutBtn;
}

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
    if (section.unsectioned) {
      const block = document.createElement("div");
      block.className = "builder-standalone-block";
      block.dataset.sectionId = section.id;
      const controls = document.createElement("div");
      controls.className = "builder-standalone-controls";
      controls.appendChild(renderColumnsControl(section, state, worksheetId, onChange));
      const fields = document.createElement("div");
      fields.className = "builder-fields-container";
      renderFieldEditor(fields, state, worksheetId, section.id, section, onChange, onLightChange);
      block.appendChild(controls);
      block.appendChild(fields);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "builder-remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        state.removeSection(worksheetId, section.id);
        onChange();
      });
      block.appendChild(removeBtn);
      container.appendChild(block);
      return;
    }
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

    const columnsLabel = renderColumnsControl(section, state, worksheetId, onChange, true);

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
    card.appendChild(startCollapsedLabel);
    card.appendChild(fieldsContainer);
    card.appendChild(removeSectionBtn);

    container.appendChild(card);
  });

  const addActions = document.createElement("div");
  addActions.className = "builder-add-actions";

  const addStandaloneLayoutBtn = renderStandaloneLayoutButton(state, worksheetId, onChange);

  const addSectionBtn = document.createElement("button");
  addSectionBtn.type = "button";
  addSectionBtn.className = "builder-add-section-btn";
  addSectionBtn.textContent = "+ Add section";
  addSectionBtn.addEventListener("click", () => {
    state.addSection(worksheetId, { title: "New section" });
    onChange();
  });
  addActions.appendChild(addStandaloneLayoutBtn);
  addActions.appendChild(addSectionBtn);
  container.appendChild(addActions);
}
