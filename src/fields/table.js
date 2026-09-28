import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { sanitizeContent } from "./content.js";

const TEXTUAL_TYPES = new Set(["short-text", "long-text", "number", "dropdown"]);
const STATIC_TYPES = new Set(["header", "content"]);
const wiredAddRowButtons = new WeakSet();

export const TABLE_CELL_TYPES = [
  { type: "short-text", name: "Short text" },
  { type: "long-text", name: "Long text" },
  { type: "number", name: "Number" },
  { type: "dropdown", name: "Dropdown" },
  { type: "content", name: "Content" },
];

function safeColumns(field) {
  const columns = Array.isArray(field.columns) ? field.columns : [];
  return columns.length
    ? columns.map((column, index) => ({
        id: column.id || `column_${index + 1}`,
        label: column.label || `Column ${index + 1}`,
        type: column.type || "short-text",
        options: Array.isArray(column.options) ? column.options : [],
        content: column.content || "",
      }))
    : [
        { id: "column_1", label: "Column 1", type: "short-text", options: [] },
        { id: "column_2", label: "Column 2", type: "long-text", options: [] },
      ];
}

function cellId(rowIndex, columnIndex) {
  return `cell_${rowIndex + 1}_${columnIndex + 1}`;
}

function normalizeCell(cell, rowIndex, columnIndex) {
  const type = cell?.type || (rowIndex === 0 ? "header" : "content");
  return {
    id: cell?.id || cellId(rowIndex, columnIndex),
    type,
    content: cell?.content ?? (type === "header" ? `Column ${columnIndex + 1}` : ""),
    options: Array.isArray(cell?.options) ? cell.options : [],
  };
}

function cellsFromColumns(field) {
  const columns = safeColumns(field);
  const count = Math.max(Number(field.initialRows) || 1, 1) + 1;
  return Array.from({ length: count }, (_, rowIndex) =>
    columns.map((column, columnIndex) => {
      if (rowIndex === 0) {
        return normalizeCell(
          { id: `header_${column.id}`, type: "header", content: column.label || `Column ${columnIndex + 1}` },
          rowIndex,
          columnIndex
        );
      }
      return normalizeCell(
        {
          id: rowIndex === 1 ? column.id : cellId(rowIndex, columnIndex),
          type: column.type,
          content: column.content || "",
          options: column.options,
        },
        rowIndex,
        columnIndex
      );
    })
  );
}

function safeCells(field) {
  const source = Array.isArray(field.cells) && field.cells.length ? field.cells : cellsFromColumns(field);
  const columnCount = Math.max(...source.map((row) => (Array.isArray(row) ? row.length : 0)), 1);
  return source.map((row, rowIndex) =>
    Array.from({ length: columnCount }, (_, columnIndex) => normalizeCell(Array.isArray(row) ? row[columnIndex] : null, rowIndex, columnIndex))
  );
}

function defaultRows(field) {
  const count = Math.max(Number(field.initialRows) || 1, 1);
  return Array.from({ length: count }, () => ({}));
}

function answerCells(cells) {
  return cells.flatMap((row) => row.filter((cell) => TEXTUAL_TYPES.has(cell.type)));
}

function templateRow(cells) {
  return [...cells].reverse().find((row) => row.some((cell) => TEXTUAL_TYPES.has(cell.type))) || cells[cells.length - 1] || [];
}

function makeCellControl(field, cell, rowIndex, value = "") {
  const name = `${field.id}_${cell.id}_${rowIndex}`;
  if (cell.type === "long-text") {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.rows = 3;
    textarea.value = value == null ? cell.content || "" : value;
    textarea.placeholder = cell.content || "";
    return textarea;
  }
  if (cell.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    input.value = value == null ? cell.content || "" : value;
    input.placeholder = cell.content || "";
    return input;
  }
  if (cell.type === "dropdown") {
    const select = document.createElement("select");
    select.name = name;
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select...";
    select.appendChild(blank);
    for (const option of cell.options || []) {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    }
    select.value = value == null ? "" : value;
    return select;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.value = value == null ? cell.content || "" : value;
  input.placeholder = cell.content || "";
  return input;
}

function renderStaticCell(cell) {
  const div = document.createElement("div");
  div.className = cell.type === "header" ? "wb-table-cell-header" : "wb-table-cell-content";
  div.innerHTML = sanitizeContent(cell.content || "");
  return div;
}

function controlForCell(row, cellIdValue) {
  const cell = Array.from(row.children).find((child) => child.dataset.cellId === cellIdValue || child.dataset.columnId === cellIdValue);
  return cell?.querySelector("input, textarea, select") || null;
}

function appendCellRow(tbody, field, cellRow, rowValue = {}, rowClass = "wb-table-input-row") {
  const row = document.createElement("tr");
  row.className = rowClass;
  const rowIndex = tbody.querySelectorAll(`.${rowClass}`).length;

  cellRow.forEach((cell) => {
    const td = document.createElement(cell.type === "header" ? "th" : "td");
    if (cell.type === "header") td.scope = "col";
    td.dataset.cellId = cell.id;
    td.dataset.columnId = cell.id;
    td.dataset.cellType = cell.type;
    td.dataset.options = JSON.stringify(cell.options || []);
    td.dataset.content = cell.content || "";
    if (STATIC_TYPES.has(cell.type)) td.appendChild(renderStaticCell(cell));
    else td.appendChild(makeCellControl(field, cell, rowIndex, rowValue[cell.id]));
    row.appendChild(td);
  });

  tbody.appendChild(row);
  return row;
}

function appendLegacyInputRow(tbody, field, columns, rowValue = {}) {
  const row = document.createElement("tr");
  row.className = "wb-table-input-row";
  const rowIndex = tbody.querySelectorAll(".wb-table-input-row").length;

  columns.forEach((column) => {
    const cell = document.createElement("td");
    cell.dataset.columnId = column.id;
    cell.dataset.cellId = column.id;
    cell.dataset.cellType = column.type;
    if (column.type === "content") cell.appendChild(renderStaticCell({ ...column, type: "content" }));
    else cell.appendChild(makeCellControl(field, column, rowIndex, rowValue[column.id]));
    row.appendChild(cell);
  });

  tbody.appendChild(row);
  return row;
}

function renumberControls(tbody, field, cellsOrColumns) {
  Array.from(tbody.querySelectorAll(".wb-table-input-row")).forEach((row, rowIndex) => {
    cellsOrColumns.flat().forEach((cell) => {
      const control = controlForCell(row, cell.id);
      if (control) control.name = `${field.id}_${cell.id}_${rowIndex}`;
    });
  });
}

export function addTableInputRow(wrapper, rowValue = {}) {
  const field = table.configFromWrapper(wrapper);
  const tbody = wrapper.querySelector("tbody");
  if (!tbody) return null;
  if (field.cells?.length) {
    const row = appendCellRow(tbody, field, templateRow(safeCells(field)), rowValue);
    renumberControls(tbody, field, safeCells(field));
    return row;
  }
  const columns = safeColumns(field);
  const row = appendLegacyInputRow(tbody, field, columns, rowValue);
  renumberControls(tbody, field, columns);
  return row;
}

export function wireTableAddRow(wrapper) {
  const button = wrapper.querySelector(".wb-table-add-row");
  if (!button || wiredAddRowButtons.has(button)) return;
  wiredAddRowButtons.add(button);
  button.addEventListener("click", () => {
    addTableInputRow(wrapper);
    wrapper.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export const table = {
  render(field, value) {
    const hasCellGrid = Array.isArray(field.cells) && field.cells.length > 0;
    const cells = safeCells(field);
    const columns = safeColumns(field);
    const rows = Array.isArray(value) && value.length ? value : defaultRows(field);
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field));

    const scroll = document.createElement("div");
    scroll.className = "wb-table-scroll";
    const tableEl = document.createElement("table");
    tableEl.className = "wb-input-table";
    tableEl.dataset.allowAddRows = field.allowAddRows ? "true" : "false";

    if (hasCellGrid) {
      tableEl.dataset.cellGrid = "true";
      const tbody = document.createElement("tbody");
      let valueIndex = 0;
      cells.forEach((cellRow) => {
        const isInputRow = cellRow.some((cell) => TEXTUAL_TYPES.has(cell.type));
        appendCellRow(tbody, field, cellRow, isInputRow ? rows[valueIndex++] || {} : {}, isInputRow ? "wb-table-input-row" : "wb-table-static-row");
      });
      tableEl.appendChild(tbody);
    } else {
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.dataset.columnId = column.id;
        th.dataset.cellType = column.type;
        th.dataset.options = JSON.stringify(column.options || []);
        if (column.content) th.dataset.content = column.content;
        th.textContent = column.label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      tableEl.appendChild(thead);

      const tbody = document.createElement("tbody");
      rows.forEach((row) => appendLegacyInputRow(tbody, field, columns, row || {}));
      tableEl.appendChild(tbody);
    }
    scroll.appendChild(tableEl);
    wrapper.appendChild(scroll);

    if (field.allowAddRows) {
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "wb-table-add-row";
      addButton.textContent = "Add row";
      wrapper.appendChild(addButton);
      wireTableAddRow(wrapper);
    }

    wrapper.appendChild(createErrorSlot(field));
    return wrapper;
  },
  getValue(wrapper) {
    const config = table.configFromWrapper(wrapper);
    if (config.cells?.length) {
      return Array.from(wrapper.querySelectorAll(".wb-table-input-row")).map((row) => {
        const value = {};
        Array.from(row.children).forEach((cell) => {
          const control = cell.querySelector("input, textarea, select");
          if (control && cell.dataset.cellId) value[cell.dataset.cellId] = control.value;
        });
        return value;
      });
    }
    const cells = config.columns.filter((column) => TEXTUAL_TYPES.has(column.type));
    return Array.from(wrapper.querySelectorAll(".wb-table-input-row")).map((row) => {
      const value = {};
      cells.forEach((cell) => {
        const control = controlForCell(row, cell.id);
        value[cell.id] = control ? control.value : "";
      });
      return value;
    });
  },
  setValue(wrapper, value) {
    const field = table.configFromWrapper(wrapper);
    const tbody = wrapper.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const rows = Array.isArray(value) && value.length ? value : defaultRows(field);
    if (field.cells?.length) {
      let valueIndex = 0;
      safeCells(field).forEach((cellRow) => {
        const isInputRow = cellRow.some((cell) => TEXTUAL_TYPES.has(cell.type));
        appendCellRow(tbody, field, cellRow, isInputRow ? rows[valueIndex++] || {} : {}, isInputRow ? "wb-table-input-row" : "wb-table-static-row");
      });
      renumberControls(tbody, field, safeCells(field));
      return;
    }
    const columns = safeColumns(field);
    rows.forEach((row) => appendLegacyInputRow(tbody, field, columns, row || {}));
    renumberControls(tbody, field, columns);
  },
  validate(field, value) {
    if (!field.required) return true;
    const cells = field.cells?.length ? answerCells(safeCells(field)) : safeColumns(field).filter((column) => TEXTUAL_TYPES.has(column.type));
    const rows = Array.isArray(value) ? value : [];
    const hasInput = rows.some((row) => cells.some((cell) => String(row?.[cell.id] || "").trim()));
    return hasInput ? true : "Enter at least one table value.";
  },
  configFromWrapper(wrapper) {
    const tableEl = wrapper.querySelector(".wb-input-table");
    const base = {
      id: wrapper.dataset.fieldId,
      type: "table",
      label: wrapper.querySelector(".wb-field-label")?.childNodes[0]?.textContent?.trim() || "",
      required: Boolean(wrapper.querySelector(".wb-required-marker")),
      allowAddRows: tableEl?.dataset.allowAddRows === "true",
      initialRows: wrapper.querySelectorAll(".wb-table-input-row").length || 1,
    };
    if (tableEl?.dataset.cellGrid === "true") {
      return {
        ...base,
        cells: Array.from(tableEl.querySelectorAll("tbody tr")).map((row, rowIndex) =>
          Array.from(row.children).map((cell, columnIndex) => ({
            id: cell.dataset.cellId || cell.dataset.columnId || cellId(rowIndex, columnIndex),
            type: cell.dataset.cellType || (cell.tagName === "TH" ? "header" : "short-text"),
            content: cell.dataset.content || (cell.dataset.cellType === "dropdown" ? "" : cell.textContent.trim()) || "",
            options: cell.dataset.options ? JSON.parse(cell.dataset.options) : [],
          }))
        ),
      };
    }
    const headers = Array.from(wrapper.querySelectorAll(".wb-input-table thead th"));
    return {
      ...base,
      columns: headers.map((th, index) => ({
        id: th.dataset.columnId || `column_${index + 1}`,
        label: th.textContent.trim() || `Column ${index + 1}`,
        type: th.dataset.cellType || "short-text",
        options: th.dataset.options ? JSON.parse(th.dataset.options) : [],
        content: th.dataset.content || "",
      })),
    };
  },
};
