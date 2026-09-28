import { renderTextEditor } from "./text-editor.js";
import { renderContentEditor } from "./content-editor.js";
import {
  DESIGNER_FIELD_TYPES,
  OPTIONS_FIELD_TYPES,
  DISPLAY_ONLY_FIELD_TYPES,
  IMAGE_FIELD_TYPES,
} from "../../../src/fields/index.js";
import { groupByColumn } from "../../../src/core/column-layout.js";
import { TABLE_CELL_TYPES } from "../../../src/fields/table.js";

function renderOptionsEditor(field, onChange, onLightChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-options-editor";

  const options = field.options || (field.options = []);
  options.forEach((option, index) => {
    const row = document.createElement("div");
    row.className = "builder-option-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = option;
    input.addEventListener("input", () => {
      // mutate in place — this is a light refresh, so the options array
      // reference passed to onChange elsewhere must stay in sync
      options[index] = input.value;
      onLightChange();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove option";
    removeBtn.addEventListener("click", () => {
      onChange({ options: options.filter((_, i) => i !== index) });
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    wrap.appendChild(row);
  });

  const addOptionBtn = document.createElement("button");
  addOptionBtn.type = "button";
  addOptionBtn.className = "builder-add-option-btn";
  addOptionBtn.textContent = "+ Add option";
  addOptionBtn.addEventListener("click", () => {
    onChange({ options: [...options, `Option ${options.length + 1}`] });
  });
  wrap.appendChild(addOptionBtn);

  return wrap;
}

function defaultTableColumns() {
  return [
    { id: "column_1", label: "Column 1", type: "short-text", options: [] },
    { id: "column_2", label: "Column 2", type: "long-text", options: [] },
  ];
}

function normalizeTableColumns(field) {
  if (!Array.isArray(field.columns) || field.columns.length === 0) {
    field.columns = defaultTableColumns();
  }
  field.columns.forEach((column, index) => {
    column.id = column.id || `column_${index + 1}`;
    column.label = column.label || `Column ${index + 1}`;
    column.type = column.type || "short-text";
    if (!Array.isArray(column.options)) column.options = [];
    if (column.content == null) column.content = "";
  });
  if (!field.initialRows) field.initialRows = 1;
}

function renderTableEditor(field, onChange, onLightChange) {
  normalizeTableColumns(field);
  const wrap = document.createElement("div");
  wrap.className = "builder-table-editor";

  const rowCountLabel = document.createElement("label");
  rowCountLabel.textContent = "Starting rows";
  const rowCountInput = document.createElement("input");
  rowCountInput.type = "number";
  rowCountInput.min = "1";
  rowCountInput.value = String(field.initialRows || 1);
  rowCountInput.addEventListener("input", () => {
    field.initialRows = Math.max(Number(rowCountInput.value) || 1, 1);
    onLightChange();
  });
  rowCountLabel.appendChild(rowCountInput);
  wrap.appendChild(rowCountLabel);

  const addRowsLabel = document.createElement("label");
  const addRowsCheckbox = document.createElement("input");
  addRowsCheckbox.type = "checkbox";
  addRowsCheckbox.checked = Boolean(field.allowAddRows);
  addRowsCheckbox.addEventListener("change", () => {
    field.allowAddRows = addRowsCheckbox.checked;
    onChange({ allowAddRows: addRowsCheckbox.checked });
  });
  addRowsLabel.appendChild(addRowsCheckbox);
  addRowsLabel.appendChild(document.createTextNode(" Learners can add rows"));
  wrap.appendChild(addRowsLabel);

  const columnsWrap = document.createElement("div");
  columnsWrap.className = "builder-table-columns";
  field.columns.forEach((column, index) => {
    const row = document.createElement("div");
    row.className = "builder-table-column-row";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = column.label;
    labelInput.placeholder = `Column ${index + 1}`;
    labelInput.addEventListener("input", () => {
      column.label = labelInput.value;
      onLightChange();
    });
    row.appendChild(labelInput);

    const typeSelect = document.createElement("select");
    TABLE_CELL_TYPES.forEach(({ type, name }) => {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = name;
      typeSelect.appendChild(opt);
    });
    typeSelect.value = column.type;
    typeSelect.addEventListener("change", () => {
      column.type = typeSelect.value;
      onChange({ columns: field.columns });
    });
    row.appendChild(typeSelect);

    if (column.type === "dropdown") {
      const optionsInput = document.createElement("input");
      optionsInput.type = "text";
      optionsInput.value = column.options.join(", ");
      optionsInput.placeholder = "Options, separated by commas";
      optionsInput.addEventListener("input", () => {
        column.options = optionsInput.value.split(",").map((option) => option.trim()).filter(Boolean);
        onLightChange();
      });
      row.appendChild(optionsInput);
    }

    if (column.type === "content") {
      const contentInput = document.createElement("input");
      contentInput.type = "text";
      contentInput.value = column.content || "";
      contentInput.placeholder = "Content shown in this column";
      contentInput.addEventListener("input", () => {
        column.content = contentInput.value;
        onLightChange();
      });
      row.appendChild(contentInput);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove column";
    removeBtn.disabled = field.columns.length <= 1;
    removeBtn.addEventListener("click", () => {
      onChange({ columns: field.columns.filter((_, i) => i !== index) });
    });
    row.appendChild(removeBtn);

    columnsWrap.appendChild(row);
  });
  wrap.appendChild(columnsWrap);

  const addColumnBtn = document.createElement("button");
  addColumnBtn.type = "button";
  addColumnBtn.className = "builder-add-option-btn";
  addColumnBtn.textContent = "+ Add column";
  addColumnBtn.addEventListener("click", () => {
    const next = field.columns.length + 1;
    onChange({ columns: [...field.columns, { id: `column_${next}`, label: `Column ${next}`, type: "short-text", options: [] }] });
  });
  wrap.appendChild(addColumnBtn);

  return wrap;
}

/** Fixes up a checklist's dependsOn array after item `removedIndex` is
 * deleted: any item that depended on it is unlocked (dependsOn -> null),
 * and every reference to a later index shifts down by one to stay
 * pointing at the same item. */
function removeChecklistDependsOnIndex(dependsOn, removedIndex) {
  return dependsOn
    .filter((_, i) => i !== removedIndex)
    .map((dep) => {
      if (dep === removedIndex) return null;
      if (typeof dep === "number" && dep > removedIndex) return dep - 1;
      return dep;
    });
}

/**
 * A checklist's own item editor — like renderOptionsEditor, but each item
 * also gets a "Depends on" picker so unlocking isn't limited to "the item
 * right before this one": item 4 can depend on item 1 directly, or on
 * nothing at all. Replaces the generic options editor for this type since
 * that per-item dependency picker has no equivalent there.
 */
function renderChecklistItemsEditor(field, onChange, onLightChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-options-editor";

  const options = field.options || (field.options = []);
  const dependsOn = field.dependsOn || (field.dependsOn = options.map(() => null));
  while (dependsOn.length < options.length) dependsOn.push(null);

  const optionsHtml = field.optionsHtml || (field.optionsHtml = options.map(() => null));
  options.forEach((option, index) => {
    const row = document.createElement("div");
    row.className = "builder-option-row";

    row.classList.add("builder-checklist-option-row");
    const input = renderTextEditor({ text: option, textHtml: optionsHtml[index] }, "text", "builder-checklist-item-input", `Item ${index + 1}`, (patch) => {
      options[index] = patch.text;
      optionsHtml[index] = patch.textHtml;
      wrap.querySelectorAll('select[data-checklist-dependency] option').forEach((entry) => {
        if (entry.value === String(index)) entry.textContent = `Depends on: ${patch.text || `Item ${index + 1}`}`;
      });
      onLightChange();
    });

    const dependsSelect = document.createElement("select");
    dependsSelect.dataset.checklistDependency = "true";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "Doesn't depend on anything";
    dependsSelect.appendChild(noneOpt);
    options.forEach((otherOption, otherIndex) => {
      if (otherIndex === index) return;
      const opt = document.createElement("option");
      opt.value = String(otherIndex);
      opt.textContent = `Depends on: ${otherOption || `Item ${otherIndex + 1}`}`;
      dependsSelect.appendChild(opt);
    });
    dependsSelect.value = Number.isInteger(dependsOn[index]) ? String(dependsOn[index]) : "";
    dependsSelect.addEventListener("change", () => {
      dependsOn[index] = dependsSelect.value === "" ? null : Number(dependsSelect.value);
      onLightChange();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove option";
    removeBtn.addEventListener("click", () => {
      onChange({
        options: options.filter((_, i) => i !== index),
        optionsHtml: optionsHtml.filter((_, i) => i !== index),
        dependsOn: removeChecklistDependsOnIndex(dependsOn, index),
      });
    });

    row.appendChild(input);
    row.appendChild(dependsSelect);
    row.appendChild(removeBtn);
    wrap.appendChild(row);
  });

  const addOptionBtn = document.createElement("button");
  addOptionBtn.type = "button";
  addOptionBtn.className = "builder-add-option-btn";
  addOptionBtn.textContent = "+ Add option";
  addOptionBtn.addEventListener("click", () => {
    onChange({ options: [...options, `Option ${options.length + 1}`], optionsHtml: [...optionsHtml, null], dependsOn: [...dependsOn, null] });
  });
  wrap.appendChild(addOptionBtn);

  return wrap;
}

function buildDefaultFieldConfig(type, column) {
  const needsOptions = OPTIONS_FIELD_TYPES.has(type);
  const isImage = IMAGE_FIELD_TYPES.has(type);
  return {
    type,
    label: isImage || type === "content" ? "" : "New question",
    ...(type === "content" ? { html: "<p><br></p>" } : {}),
    column: column || 0,
    ...(needsOptions ? { options: ["Option 1", "Option 2"] } : {}),
    ...(type === "table" ? { columns: defaultTableColumns(), initialRows: 1, allowAddRows: true } : {}),
    ...(isImage ? { src: "", alt: "", caption: "" } : {}),
  };
}

function renderImageFieldControls(field, onLightChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-image-field-controls";

  const srcInput = document.createElement("input");
  srcInput.type = "text";
  srcInput.placeholder = "Image URL";
  srcInput.value = field.src || "";
  srcInput.addEventListener("input", () => {
    field.src = srcInput.value;
    onLightChange();
  });

  const altInput = document.createElement("input");
  altInput.type = "text";
  altInput.placeholder = "Alt text";
  altInput.value = field.alt || "";
  altInput.addEventListener("input", () => {
    field.alt = altInput.value;
    onLightChange();
  });

  const captionInput = document.createElement("input");
  captionInput.type = "text";
  captionInput.placeholder = "Caption (optional)";
  captionInput.value = field.caption || "";
  captionInput.addEventListener("input", () => {
    field.caption = captionInput.value;
    onLightChange();
  });

  wrap.appendChild(srcInput);
  wrap.appendChild(altInput);
  wrap.appendChild(captionInput);
  return wrap;
}

function createTypeSelect() {
  const select = document.createElement("select");
  select.className = "builder-add-field-type-select";
  for (const { type, name } of DESIGNER_FIELD_TYPES) {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = name;
    select.appendChild(opt);
  }
  return select;
}

function selectedFieldIds(container, fallbackId) {
  const checked = Array.from(container.ownerDocument.querySelectorAll(".builder-field-select:checked"))
    .map((input) => input.closest(".builder-field-row")?.dataset.fieldId)
    .filter(Boolean);
  return checked.includes(fallbackId) ? checked : [fallbackId];
}

function renderFieldRow({ field, index, fieldCount, state, worksheetId, sectionId, onChange, onLightChange }) {
  const row = document.createElement("div");
  row.className = "builder-field-row";
  row.dataset.fieldId = field.id;

  const selectBox = document.createElement("input");
  selectBox.type = "checkbox";
  selectBox.className = "builder-field-select";
  selectBox.setAttribute("aria-label", `Select ${field.label || field.type || "question"} for moving`);
  row.appendChild(selectBox);

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "builder-drag-handle";
  dragHandle.textContent = "☰";
  dragHandle.title = "Drag to move this question. Tick multiple questions first to move them together.";
  dragHandle.setAttribute("aria-label", "Drag question");
  dragHandle.draggable = true;
  dragHandle.addEventListener("dragstart", (event) => {
    const ids = selectedFieldIds(row, field.id);
    event.dataTransfer?.setData("application/x-builder-field-ids", JSON.stringify(ids));
    event.dataTransfer?.setData("text/plain", ids.join(","));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    row.classList.add("builder-field-row-dragging");
  });
  dragHandle.addEventListener("dragend", () => row.classList.remove("builder-field-row-dragging"));
  row.appendChild(dragHandle);

  const reorderControls = document.createElement("div");
  reorderControls.className = "builder-reorder-controls";

  const moveUpBtn = document.createElement("button");
  moveUpBtn.type = "button";
  moveUpBtn.className = "builder-move-btn";
  moveUpBtn.textContent = "▲";
  moveUpBtn.setAttribute("aria-label", "Move question up");
  moveUpBtn.title = "Move up";
  moveUpBtn.disabled = index === 0;
  moveUpBtn.addEventListener("click", () => {
    state.reorderField(worksheetId, sectionId, field.id, index - 1);
    onChange();
  });

  const moveDownBtn = document.createElement("button");
  moveDownBtn.type = "button";
  moveDownBtn.className = "builder-move-btn";
  moveDownBtn.textContent = "▼";
  moveDownBtn.setAttribute("aria-label", "Move question down");
  moveDownBtn.title = "Move down";
  moveDownBtn.disabled = index === fieldCount - 1;
  moveDownBtn.addEventListener("click", () => {
    state.reorderField(worksheetId, sectionId, field.id, index + 1);
    onChange();
  });

  reorderControls.appendChild(moveUpBtn);
  reorderControls.appendChild(moveDownBtn);
  row.appendChild(reorderControls);

  const typeLabel = document.createElement("span");
  typeLabel.className = "builder-field-type-label";
  const typeInfo = DESIGNER_FIELD_TYPES.find((t) => t.type === field.type);
  typeLabel.textContent = typeInfo ? typeInfo.name : field.type;
  row.appendChild(typeLabel);

  if (field.type === "content") {
    row.classList.add("builder-field-row-content");
    row.appendChild(renderContentEditor(field, (html) => {
      state.updateField(worksheetId, sectionId, field.id, { html });
      onLightChange();
    }));
  } else if (IMAGE_FIELD_TYPES.has(field.type)) {
    row.appendChild(renderImageFieldControls(field, onLightChange));
  } else {
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "builder-field-label-input";
    labelInput.value = field.label || "";
    labelInput.placeholder = "Question label";
    labelInput.addEventListener("input", () => {
      state.updateField(worksheetId, sectionId, field.id, { label: labelInput.value });
      onLightChange();
    });
    row.appendChild(labelInput);
  }

  if (!DISPLAY_ONLY_FIELD_TYPES.has(field.type) && field.type !== "checkbox") {
    const requiredLabel = document.createElement("label");
    const requiredCheckbox = document.createElement("input");
    requiredCheckbox.type = "checkbox";
    requiredCheckbox.checked = Boolean(field.required);
    requiredCheckbox.addEventListener("change", () => {
      state.updateField(worksheetId, sectionId, field.id, { required: requiredCheckbox.checked });
      onChange();
    });
    requiredLabel.appendChild(requiredCheckbox);
    requiredLabel.appendChild(document.createTextNode(" Required"));
    row.appendChild(requiredLabel);
  }

  if (field.type === "checklist") {
    row.appendChild(
      renderChecklistItemsEditor(
        field,
        (patch) => {
          state.updateField(worksheetId, sectionId, field.id, patch);
          onChange();
        },
        onLightChange
      )
    );
  } else if (field.type === "table") {
    row.appendChild(
      renderTableEditor(
        field,
        (patch) => {
          state.updateField(worksheetId, sectionId, field.id, patch);
          onChange();
        },
        onLightChange
      )
    );
  } else if (OPTIONS_FIELD_TYPES.has(field.type)) {
    row.appendChild(
      renderOptionsEditor(
        field,
        (patch) => {
          state.updateField(worksheetId, sectionId, field.id, patch);
          onChange();
        },
        onLightChange
      )
    );
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "builder-remove-btn";
  removeBtn.textContent = "Remove question";
  removeBtn.addEventListener("click", () => {
    state.removeField(worksheetId, sectionId, field.id);
    onChange();
  });
  row.appendChild(removeBtn);

  return row;
}

/**
 * Renders the field list for one section as N independent column stacks —
 * grouped by each field's own stored `column` index (the same stable,
 * explicit-property grouping the Runtime uses via groupByColumn), never
 * recomputed from the total field count. That stability is what makes
 * "column 1" and "column 2" behave like actual separate lists: adding or
 * removing a question in one column never reshuffles another column's
 * contents. Each column has its own type picker + "+ Add question" control
 * at the bottom of that column specifically — a single shared picker at the
 * top of the whole section stops being useful once a column's list is long
 * enough that the picker scrolls out of view from where you're adding.
 * Every control here is click/select/type-a-label — no code entry. Image
 * is just another type in this same list, not a separate add-image
 * mechanism.
 */
export function renderFieldEditor(container, state, worksheetId, sectionId, section, onChange, onLightChange) {
  container.innerHTML = "";

  const columnCount = section.columns || 1;
  const fieldCount = section.fields.length;

  const fieldList = document.createElement("div");
  fieldList.className = "builder-field-list";
  fieldList.dataset.columns = String(columnCount);

  const columns = groupByColumn(section.fields, columnCount, (field) => field.column);

  columns.forEach((column, columnIndex) => {
    const columnEl = document.createElement("div");
    columnEl.className = "builder-field-column";

    // Each column's own picker — also used by that column's rows' "insert
    // right after this one" buttons, so an insertion always uses the type
    // currently selected for the column it's inserting into.
    const typeSelect = createTypeSelect();

    for (const { item: field, index } of column) {
      columnEl.appendChild(
        renderFieldRow({
          field,
          index,
          fieldCount,
          state,
          worksheetId,
          sectionId,
          onChange,
          onLightChange,
        })
      );
    }

    const insertIndex = column.length ? column[column.length - 1].index + 1 : fieldCount;
    const dropZone = document.createElement("div");
    dropZone.className = "builder-field-drop-zone";
    dropZone.textContent = section.unsectioned || sectionId == null
      ? "Drop questions here to move them outside sections"
      : `Drop questions here for column ${columnIndex + 1}`;
    dropZone.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("application/x-builder-field-ids")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      dropZone.classList.add("builder-field-drop-zone-active");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("builder-field-drop-zone-active"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("builder-field-drop-zone-active");
      const raw = event.dataTransfer?.getData("application/x-builder-field-ids");
      if (!raw) return;
      const ids = JSON.parse(raw);
      state.moveFields(worksheetId, ids, sectionId, columnIndex);
      onChange();
    });
    columnEl.appendChild(dropZone);

    const addRow = document.createElement("div");
    addRow.className = "builder-add-field-row";

    const addToColumnBtn = document.createElement("button");
    addToColumnBtn.type = "button";
    addToColumnBtn.className = "builder-add-field-btn builder-add-to-column-btn";
    addToColumnBtn.textContent = "+ Add question";
    addToColumnBtn.title = "Add a new question of the selected type to the end of this column";
    addToColumnBtn.addEventListener("click", () => {
      const fieldConfig = buildDefaultFieldConfig(typeSelect.value, columnIndex);
      if (sectionId == null) fieldConfig._sectionColumns = columnCount;
      state.addField(worksheetId, sectionId, fieldConfig, insertIndex);
      onChange();
    });

    addRow.appendChild(typeSelect);
    addRow.appendChild(addToColumnBtn);
    columnEl.appendChild(addRow);

    fieldList.appendChild(columnEl);
  });

  container.appendChild(fieldList);
}
