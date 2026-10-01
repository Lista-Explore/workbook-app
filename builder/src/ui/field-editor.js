import { renderTextEditor } from "./text-editor.js";
import { renderContentEditor } from "./content-editor.js";
import {
  DESIGNER_FIELD_TYPES,
  OPTIONS_FIELD_TYPES,
  DISPLAY_ONLY_FIELD_TYPES,
  IMAGE_FIELD_TYPES,
} from "../../../src/fields/index.js";
import { groupByColumn, groupByBlockThenColumn } from "../../../src/core/column-layout.js";
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

function defaultTableCells() {
  return [
    [
      { id: "cell_1_1", type: "header", content: "", options: [] },
      { id: "cell_1_2", type: "header", content: "", options: [] },
    ],
    [
      { id: "cell_2_1", type: "content", content: "", options: [] },
      { id: "cell_2_2", type: "content", content: "", options: [] },
    ],
  ];
}

function makeTableCell(rowIndex, columnIndex, patch = {}) {
  return {
    id: `cell_${rowIndex + 1}_${columnIndex + 1}`,
    type: rowIndex === 0 ? "header" : "content",
    content: "",
    options: [],
    ...patch,
  };
}

function cellsFromColumns(field) {
  const columns = Array.isArray(field.columns) && field.columns.length ? field.columns : defaultTableColumns();
  const rowCount = Math.max(Number(field.initialRows) || 1, 1) + 1;
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    columns.map((column, columnIndex) => {
      if (rowIndex === 0) {
        return makeTableCell(rowIndex, columnIndex, {
          id: `header_${column.id || columnIndex + 1}`,
          type: "header",
          content: column.label || `Column ${columnIndex + 1}`,
        });
      }
      return makeTableCell(rowIndex, columnIndex, {
        id: rowIndex === 1 ? column.id || `column_${columnIndex + 1}` : `cell_${rowIndex + 1}_${columnIndex + 1}`,
        type: "content",
        content: column.content || "",
        options: [],
      });
    })
  );
}

function normalizeTableCells(field) {
  if (!Array.isArray(field.cells) || field.cells.length === 0) {
    field.cells = Array.isArray(field.columns) && field.columns.length ? cellsFromColumns(field) : defaultTableCells();
  }
  const columnCount = Math.max(...field.cells.map((row) => (Array.isArray(row) ? row.length : 0)), 1);
  if (!Array.isArray(field.columnWidths)) field.columnWidths = [];
  field.columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const width = Number(field.columnWidths[index]);
    return Number.isFinite(width) && width > 0 ? width : Math.round(100 / columnCount);
  });
  field.cells = field.cells.map((row, rowIndex) => {
    const safeRow = Array.isArray(row) ? row : [];
    return Array.from({ length: columnCount }, (_, columnIndex) => {
      const cell = safeRow[columnIndex] || makeTableCell(rowIndex, columnIndex);
      cell.id = cell.id || `cell_${rowIndex + 1}_${columnIndex + 1}`;
      cell.type = cell.type || (rowIndex === 0 ? "header" : "content");
      if (cell.content == null) cell.content = "";
      if (!Array.isArray(cell.options)) cell.options = [];
      return cell;
    });
  });
  field.initialRows = Math.max(field.cells.length - 1, 1);
}

function tableCellTypeOptions() {
  return [{ type: "header", name: "Header" }, ...TABLE_CELL_TYPES];
}

function selectedCellLabel(rowIndex, columnIndex) {
  return `Cell ${rowIndex + 1}, ${columnIndex + 1}`;
}

function normalizeColumnWidths(widths, count) {
  const safe = Array.from({ length: count }, (_, index) => {
    const width = Number(widths?.[index]);
    return Number.isFinite(width) && width > 0 ? width : Math.round(100 / count);
  });
  const total = safe.reduce((sum, width) => sum + width, 0) || count || 1;
  return safe.map((width) => Math.round((width / total) * 100));
}

const TOOLS_COLUMN_PX = () => 120;

function renderTableEditor(field, onChange, onLightChange) {
  normalizeTableCells(field);
  let selected = { row: 0, column: 0 };

  const wrap = document.createElement("div");
  wrap.className = "builder-table-editor";

  const settings = document.createElement("div");
  settings.className = "builder-table-settings";
  const addRowsLabel = document.createElement("label");
  const addRowsCheckbox = document.createElement("input");
  addRowsCheckbox.type = "checkbox";
  addRowsCheckbox.checked = Boolean(field.allowAddRows);
  addRowsCheckbox.addEventListener("change", () => {
    field.allowAddRows = addRowsCheckbox.checked;
    onChange({ allowAddRows: addRowsCheckbox.checked });
  });
  addRowsLabel.appendChild(addRowsCheckbox);
  addRowsLabel.appendChild(document.createTextNode(' Show learner "Add row" button'));
  settings.appendChild(addRowsLabel);

  const widthControls = document.createElement("div");
  widthControls.className = "builder-table-widths";
  field.columnWidths = normalizeColumnWidths(field.columnWidths, field.cells[0].length);
  const widthInputs = [];
  let applyColumnWidths = () => {};
  field.columnWidths.forEach((width, columnIndex) => {
    const label = document.createElement("label");
    label.textContent = `Column ${columnIndex + 1} width`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "5";
    input.step = "1";
    input.value = String(width);
    input.addEventListener("input", () => {
      field.columnWidths[columnIndex] = Number(input.value) || width;
      applyColumnWidths();
      onLightChange();
    });
    widthInputs.push(input);
    label.appendChild(input);
    widthControls.appendChild(label);
  });
  settings.appendChild(widthControls);
  wrap.appendChild(settings);

  const toolbar = document.createElement("div");
  toolbar.className = "builder-table-toolbar";

  const selectedName = document.createElement("strong");
  selectedName.textContent = selectedCellLabel(0, 0);
  toolbar.appendChild(selectedName);

  const typeSelect = document.createElement("select");
  typeSelect.setAttribute("aria-label", "Selected cell type");
  tableCellTypeOptions().forEach(({ type, name }) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = name;
    typeSelect.appendChild(opt);
  });
  toolbar.appendChild(typeSelect);

  const optionsInput = document.createElement("input");
  optionsInput.type = "text";
  optionsInput.placeholder = "Dropdown options, separated by commas";
  optionsInput.className = "builder-table-selected-options";
  toolbar.appendChild(optionsInput);
  wrap.appendChild(toolbar);

  const gridWrap = document.createElement("div");
  gridWrap.className = "builder-table-grid-wrap";
  const tableEl = document.createElement("table");
  tableEl.className = "builder-table-grid";
  const tbody = document.createElement("tbody");

  const selectedCell = () => field.cells[selected.row]?.[selected.column] || field.cells[0][0];
  const syncToolbar = () => {
    const cell = selectedCell();
    selectedName.textContent = selectedCellLabel(selected.row, selected.column);
    typeSelect.value = cell.type || "content";
    optionsInput.value = (cell.options || []).join(", ");
    optionsInput.hidden = cell.type !== "dropdown";
    wrap.querySelectorAll(".builder-table-grid-cell-selected").forEach((el) => el.classList.remove("builder-table-grid-cell-selected"));
    wrap.querySelector(`[data-table-row="${selected.row}"][data-table-column="${selected.column}"]`)?.classList.add("builder-table-grid-cell-selected");
  };

  const selectCell = (rowIndex, columnIndex) => {
    selected = { row: rowIndex, column: columnIndex };
    syncToolbar();
  };

  typeSelect.addEventListener("change", () => {
    const cell = selectedCell();
    cell.type = typeSelect.value;
    if (!Array.isArray(cell.options)) cell.options = [];
    onChange({ cells: field.cells, initialRows: Math.max(field.cells.length - 1, 1) });
  });

  optionsInput.addEventListener("input", () => {
    const cell = selectedCell();
    cell.options = optionsInput.value.split(",").map((option) => option.trim()).filter(Boolean);
    onLightChange();
  });

  const focusCell = (rowIndex, columnIndex) => {
    const editor = wrap.querySelector(`[data-table-row="${rowIndex}"][data-table-column="${columnIndex}"] .builder-table-cell-editor`);
    editor?.focus();
  };

  const insertRowAfter = (rowIndex) => {
    field.cells.splice(rowIndex + 1, 0, field.cells[0].map((_, columnIndex) => makeTableCell(rowIndex + 1, columnIndex)));
    onChange({ cells: field.cells, initialRows: Math.max(field.cells.length - 1, 1) });
  };

  const insertColumnAfter = (columnIndex) => {
    field.cells.forEach((row, rowIndex) => row.splice(columnIndex + 1, 0, makeTableCell(rowIndex, columnIndex + 1)));
    field.columnWidths.splice(columnIndex + 1, 0, field.columnWidths[columnIndex] || Math.round(100 / field.cells[0].length));
    onChange({ cells: field.cells, columnWidths: normalizeColumnWidths(field.columnWidths, field.cells[0].length) });
  };

  field.cells.forEach((cellRow, rowIndex) => {
    const tr = document.createElement("tr");
    cellRow.forEach((cell, columnIndex) => {
      if (!cell.type) cell.type = rowIndex === 0 ? "header" : "content";
      if (!Array.isArray(cell.options)) cell.options = [];
      const td = document.createElement("td");
      td.className = "builder-table-grid-cell";
      td.dataset.tableRow = String(rowIndex);
      td.dataset.tableColumn = String(columnIndex);
      td.dataset.cellType = cell.type;

      const editor = document.createElement("div");
      editor.className = "builder-table-cell-editor";
      editor.contentEditable = "true";
      editor.setAttribute("aria-label", selectedCellLabel(rowIndex, columnIndex));
      editor.textContent = cell.content || "";
      editor.addEventListener("focus", () => selectCell(rowIndex, columnIndex));
      editor.addEventListener("input", () => {
        cell.content = editor.textContent;
        onLightChange();
      });
      editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const direction = event.shiftKey ? -1 : 1;
          const nextColumn = columnIndex + direction;
          if (nextColumn >= 0 && nextColumn < field.cells[0].length) focusCell(rowIndex, nextColumn);
          else if (!event.shiftKey && rowIndex < field.cells.length - 1) focusCell(rowIndex + 1, 0);
          else if (event.shiftKey && rowIndex > 0) focusCell(rowIndex - 1, field.cells[0].length - 1);
        } else if (event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          insertRowAfter(rowIndex);
        } else if (event.altKey && event.key === "ArrowRight") {
          event.preventDefault();
          insertColumnAfter(columnIndex);
        }
      });
      td.addEventListener("click", () => selectCell(rowIndex, columnIndex));
      td.appendChild(editor);
      if (rowIndex === 0 && columnIndex < cellRow.length - 1) {
        const handle = document.createElement("div");
        handle.className = "builder-table-col-resize";
        handle.setAttribute("aria-hidden", "true");
        handle.title = "Drag to resize column";
        handle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          handle.setPointerCapture(event.pointerId);
          const startX = event.clientX;
          const startLeft = field.columnWidths[columnIndex];
          const startRight = field.columnWidths[columnIndex + 1];
          const available = Math.max(tableEl.offsetWidth - TOOLS_COLUMN_PX(), 1);
          const onMove = (moveEvent) => {
            const delta = ((moveEvent.clientX - startX) / available) * 100;
            const shift = Math.min(Math.max(delta, 5 - startLeft), startRight - 5);
            field.columnWidths[columnIndex] = startLeft + shift;
            field.columnWidths[columnIndex + 1] = startRight - shift;
            applyColumnWidths();
            widthInputs.forEach((input, index) => { input.value = String(Math.round(field.columnWidths[index])); });
          };
          const onUp = () => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", onUp);
            field.columnWidths = normalizeColumnWidths(field.columnWidths, field.cells[0].length);
            applyColumnWidths();
            widthInputs.forEach((input, index) => { input.value = String(field.columnWidths[index]); });
            onLightChange();
          };
          handle.addEventListener("pointermove", onMove);
          handle.addEventListener("pointerup", onUp);
          handle.addEventListener("pointercancel", onUp);
        });
        td.appendChild(handle);
      }
      tr.appendChild(td);
    });

    const controls = document.createElement("td");
    controls.className = "builder-table-row-tools";
    const insertRowBtn = document.createElement("button");
    insertRowBtn.type = "button";
    insertRowBtn.textContent = "Add row below";
    insertRowBtn.setAttribute("aria-label", "Add table row below");
    insertRowBtn.addEventListener("click", () => insertRowAfter(rowIndex));
    const removeRowBtn = document.createElement("button");
    removeRowBtn.type = "button";
    removeRowBtn.textContent = "Remove row";
    removeRowBtn.setAttribute("aria-label", "Remove table row");
    removeRowBtn.disabled = field.cells.length <= 1;
    removeRowBtn.addEventListener("click", () => {
      field.cells.splice(rowIndex, 1);
      onChange({ cells: field.cells, initialRows: Math.max(field.cells.length - 1, 1) });
    });
    controls.appendChild(insertRowBtn);
    controls.appendChild(removeRowBtn);
    tr.appendChild(controls);
    tbody.appendChild(tr);
  });

  const columnTools = document.createElement("tr");
  field.cells[0].forEach((_, columnIndex) => {
    const td = document.createElement("td");
    td.className = "builder-table-column-tools";
    const insertColumnBtn = document.createElement("button");
    insertColumnBtn.type = "button";
    insertColumnBtn.textContent = "Add column right";
    insertColumnBtn.setAttribute("aria-label", "Add table column to the right");
    insertColumnBtn.addEventListener("click", () => insertColumnAfter(columnIndex));
    const removeColumnBtn = document.createElement("button");
    removeColumnBtn.type = "button";
    removeColumnBtn.textContent = "Remove column";
    removeColumnBtn.setAttribute("aria-label", "Remove table column");
    removeColumnBtn.disabled = field.cells[0].length <= 1;
    removeColumnBtn.addEventListener("click", () => {
      field.cells.forEach((row) => row.splice(columnIndex, 1));
      field.columnWidths.splice(columnIndex, 1);
      onChange({ cells: field.cells, columnWidths: normalizeColumnWidths(field.columnWidths, field.cells[0].length) });
    });
    td.appendChild(insertColumnBtn);
    td.appendChild(removeColumnBtn);
    columnTools.appendChild(td);
  });
  columnTools.appendChild(document.createElement("td"));
  tbody.appendChild(columnTools);

  const colgroup = document.createElement("colgroup");
  const dataCols = field.cells[0].map(() => colgroup.appendChild(document.createElement("col")));
  const toolsCol = colgroup.appendChild(document.createElement("col"));
  toolsCol.style.width = `${TOOLS_COLUMN_PX()}px`;
  tableEl.appendChild(colgroup);
  tableEl.appendChild(tbody);
  gridWrap.appendChild(tableEl);
  wrap.appendChild(gridWrap);

  // Columns are stored as percentages of the data area (everything except
  // the row-tools column), so convert to pixels against the grid's width.
  applyColumnWidths = () => {
    const available = Math.max(gridWrap.clientWidth - TOOLS_COLUMN_PX(), field.cells[0].length * 60);
    dataCols.forEach((col, index) => { col.style.width = `${(field.columnWidths[index] / 100) * available}px`; });
    tableEl.style.width = `${available + TOOLS_COLUMN_PX()}px`;
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(() => applyColumnWidths()).observe(gridWrap);
  syncToolbar();

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

function buildDefaultFieldConfig(type, column, block) {
  const needsOptions = OPTIONS_FIELD_TYPES.has(type);
  const isImage = IMAGE_FIELD_TYPES.has(type);
  return {
    type,
    label: isImage || type === "content" ? "" : "New question",
    ...(type === "content" ? { html: "<p><br></p>" } : {}),
    column: column || 0,
    ...(block ? { block } : {}),
    ...(needsOptions ? { options: ["Option 1", "Option 2"] } : {}),
    ...(type === "table" ? { columns: defaultTableColumns(), cells: defaultTableCells(), initialRows: 1, allowAddRows: false } : {}),
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
/**
 * Renders one layout block's columns (the body of the loop `renderFieldEditor`
 * runs once per block). Factored out so a named section with more than one
 * layout block can repeat it, while a section with just one block (or any
 * standalone/placeholder group, which never has multiple blocks) renders
 * identically to before.
 */
function renderLayoutBlock({ columnCount, columns, blockIndex, fieldCount, state, worksheetId, sectionId, section, onChange, onLightChange }) {
  const fieldList = document.createElement("div");
  fieldList.className = "builder-field-list";
  fieldList.dataset.columns = String(columnCount);

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
      state.moveFields(worksheetId, ids, sectionId, columnIndex, undefined, blockIndex);
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
      const fieldConfig = buildDefaultFieldConfig(typeSelect.value, columnIndex, blockIndex);
      const targetSection = sectionId == null
        ? state.addStandaloneSection(worksheetId, { columns: columnCount })
        : null;
      state.addField(worksheetId, targetSection?.id || sectionId, fieldConfig, targetSection ? undefined : insertIndex);
      onChange();
    });

    addRow.appendChild(typeSelect);
    addRow.appendChild(addToColumnBtn);
    columnEl.appendChild(addRow);

    fieldList.appendChild(columnEl);
  });

  return fieldList;
}

export function renderFieldEditor(container, state, worksheetId, sectionId, section, onChange, onLightChange) {
  container.innerHTML = "";

  // Only a true named section (not standalone, not the "add new standalone"
  // placeholder) can hold more than one layout block — standalone questions
  // already get independent column counts per block by stacking separate
  // no-section layouts instead (see renderStandaloneLayoutButton).
  const supportsLayoutBlocks = sectionId != null && !section.unsectioned;
  const blockColumnCounts = supportsLayoutBlocks && Array.isArray(section.blocks) && section.blocks.length
    ? section.blocks
    : [section.columns || 1];

  const fieldCount = section.fields.length;
  const blockGroups = blockColumnCounts.length > 1
    ? groupByBlockThenColumn(section.fields, blockColumnCounts, (field) => field.block, (field) => field.column)
    : [{ columnCount: blockColumnCounts[0], columns: groupByColumn(section.fields, blockColumnCounts[0], (field) => field.column) }];

  blockGroups.forEach(({ columnCount, columns }, blockIndex) => {
    const blockWrap = document.createElement("div");
    blockWrap.className = "builder-layout-block";

    // Block 0's column count is controlled by the section's own "Columns"
    // control, rendered above this list by the section editor — only
    // blocks added after it (via "+ Start new layout in this section")
    // get their own inline control here.
    if (supportsLayoutBlocks && blockIndex > 0) {
      const blockHeader = document.createElement("div");
      blockHeader.className = "builder-layout-block-header";

      const blockColumnsLabel = document.createElement("label");
      blockColumnsLabel.className = "builder-columns-control";
      blockColumnsLabel.textContent = "Columns";
      const blockColumnsSelect = document.createElement("select");
      [1, 2, 3].forEach((n) => {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = String(n);
        blockColumnsSelect.appendChild(opt);
      });
      blockColumnsSelect.value = String(columnCount);
      blockColumnsSelect.addEventListener("change", () => {
        state.updateSectionBlock(worksheetId, sectionId, blockIndex, Number(blockColumnsSelect.value));
        onChange();
      });
      blockColumnsLabel.appendChild(blockColumnsSelect);
      blockHeader.appendChild(blockColumnsLabel);

      const removeBlockBtn = document.createElement("button");
      removeBlockBtn.type = "button";
      removeBlockBtn.className = "builder-remove-btn builder-remove-layout-block-btn";
      removeBlockBtn.textContent = "Remove layout";
      removeBlockBtn.title = "Remove this layout — its questions move up into the layout above";
      removeBlockBtn.addEventListener("click", () => {
        state.removeSectionBlock(worksheetId, sectionId, blockIndex);
        onChange();
      });
      blockHeader.appendChild(removeBlockBtn);

      blockWrap.appendChild(blockHeader);
    }

    blockWrap.appendChild(
      renderLayoutBlock({ columnCount, columns, blockIndex, fieldCount, state, worksheetId, sectionId, section, onChange, onLightChange })
    );
    container.appendChild(blockWrap);
  });

  if (supportsLayoutBlocks) {
    const addLayoutBtn = document.createElement("button");
    addLayoutBtn.type = "button";
    addLayoutBtn.className = "builder-add-layout-block-btn";
    addLayoutBtn.textContent = "+ Start new layout in this section";
    addLayoutBtn.title = "Add another group of questions below with its own column count, still inside this section";
    addLayoutBtn.addEventListener("click", () => {
      state.addSectionLayoutBlock(worksheetId, sectionId);
      onChange();
    });
    container.appendChild(addLayoutBtn);
  }
}
