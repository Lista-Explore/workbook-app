import { createWrapper, createLabel, createErrorSlot } from "./field-helpers.js";
import { sanitizeContent } from "./content.js";

const TEXTUAL_TYPES = new Set(["short-text", "long-text", "number", "dropdown"]);
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

function defaultRows(field) {
  const count = Math.max(Number(field.initialRows) || 1, 1);
  return Array.from({ length: count }, () => ({}));
}

function makeCellControl(field, column, rowIndex, value = "") {
  const name = `${field.id}_${column.id}_${rowIndex}`;
  if (column.type === "long-text") {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.rows = 3;
    textarea.value = value == null ? "" : value;
    return textarea;
  }
  if (column.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    input.value = value == null ? "" : value;
    return input;
  }
  if (column.type === "dropdown") {
    const select = document.createElement("select");
    select.name = name;
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select...";
    select.appendChild(blank);
    for (const option of column.options || []) {
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
  input.value = value == null ? "" : value;
  return input;
}

function renderContentCell(column) {
  const div = document.createElement("div");
  div.className = "wb-table-cell-content";
  div.innerHTML = sanitizeContent(column.content || "");
  return div;
}

function controlForColumn(row, columnId) {
  const cell = Array.from(row.children).find((child) => child.dataset.columnId === columnId);
  return cell?.querySelector("input, textarea, select") || null;
}

function appendInputRow(tbody, field, columns, rowValue = {}) {
  const row = document.createElement("tr");
  row.className = "wb-table-input-row";
  const rowIndex = tbody.querySelectorAll(".wb-table-input-row").length;

  columns.forEach((column) => {
    const cell = document.createElement("td");
    cell.dataset.columnId = column.id;
    cell.dataset.cellType = column.type;
    if (column.type === "content") {
      cell.appendChild(renderContentCell(column));
    } else {
      cell.appendChild(makeCellControl(field, column, rowIndex, rowValue[column.id]));
    }
    row.appendChild(cell);
  });

  tbody.appendChild(row);
  return row;
}

function renumberControls(tbody, field, columns) {
  Array.from(tbody.querySelectorAll(".wb-table-input-row")).forEach((row, rowIndex) => {
    columns.forEach((column) => {
      const control = controlForColumn(row, column.id);
      if (control) control.name = `${field.id}_${column.id}_${rowIndex}`;
    });
  });
}

export function addTableInputRow(wrapper, rowValue = {}) {
  const field = table.configFromWrapper(wrapper);
  const columns = safeColumns(field);
  const tbody = wrapper.querySelector("tbody");
  if (!tbody) return null;
  const row = appendInputRow(tbody, field, columns, rowValue);
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
    const columns = safeColumns(field);
    const rows = Array.isArray(value) && value.length ? value : defaultRows(field);
    const wrapper = createWrapper(field);
    wrapper.appendChild(createLabel(field));

    const scroll = document.createElement("div");
    scroll.className = "wb-table-scroll";
    const tableEl = document.createElement("table");
    tableEl.className = "wb-input-table";
    tableEl.dataset.allowAddRows = field.allowAddRows ? "true" : "false";

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
    rows.forEach((row) => appendInputRow(tbody, field, columns, row || {}));
    tableEl.appendChild(tbody);
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
    const columns = table.configFromWrapper(wrapper).columns.filter((column) => TEXTUAL_TYPES.has(column.type));
    return Array.from(wrapper.querySelectorAll(".wb-table-input-row")).map((row) => {
      const value = {};
      columns.forEach((column) => {
        const control = controlForColumn(row, column.id);
        value[column.id] = control ? control.value : "";
      });
      return value;
    });
  },
  setValue(wrapper, value) {
    const field = table.configFromWrapper(wrapper);
    const columns = safeColumns(field);
    const tbody = wrapper.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const rows = Array.isArray(value) && value.length ? value : defaultRows(field);
    rows.forEach((row) => appendInputRow(tbody, field, columns, row || {}));
    renumberControls(tbody, field, columns);
  },
  validate(field, value) {
    if (!field.required) return true;
    const columns = safeColumns(field).filter((column) => TEXTUAL_TYPES.has(column.type));
    const rows = Array.isArray(value) ? value : [];
    const hasInput = rows.some((row) => columns.some((column) => String(row?.[column.id] || "").trim()));
    return hasInput ? true : "Enter at least one table value.";
  },
  configFromWrapper(wrapper) {
    const headers = Array.from(wrapper.querySelectorAll(".wb-input-table thead th"));
    return {
      id: wrapper.dataset.fieldId,
      type: "table",
      label: wrapper.querySelector(".wb-field-label")?.childNodes[0]?.textContent?.trim() || "",
      required: Boolean(wrapper.querySelector(".wb-required-marker")),
      allowAddRows: wrapper.querySelector(".wb-input-table")?.dataset.allowAddRows === "true",
      initialRows: wrapper.querySelectorAll(".wb-table-input-row").length || 1,
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
