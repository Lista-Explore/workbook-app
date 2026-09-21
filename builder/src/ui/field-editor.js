import {
  DESIGNER_FIELD_TYPES,
  OPTIONS_FIELD_TYPES,
  DISPLAY_ONLY_FIELD_TYPES,
  IMAGE_FIELD_TYPES,
} from "../../../src/fields/index.js";
import { groupByColumn } from "../../../src/core/column-layout.js";

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

function buildDefaultFieldConfig(type, column) {
  const needsOptions = OPTIONS_FIELD_TYPES.has(type);
  const isImage = IMAGE_FIELD_TYPES.has(type);
  return {
    type,
    label: isImage ? "" : "New question",
    column: column || 0,
    ...(needsOptions ? { options: ["Option 1", "Option 2"] } : {}),
    ...(isImage ? { src: "", alt: "", caption: "" } : {}),
  };
}

function renderImageFieldControls(field, onLightChange) {
  const wrap = document.createElement("div");
  wrap.className = "builder-image-field-controls";

  const srcInput = document.createElement("input");
  srcInput.type = "text";
  srcInput.placeholder = "Image URL";
  srcInput.value = (field.src || "").startsWith("data:") ? "" : field.src || "";
  srcInput.addEventListener("input", () => {
    field.src = srcInput.value;
    onLightChange();
  });

  // Uploading embeds the image's actual bytes as a data URI directly in
  // field.src, instead of a remote URL — the PDF export never has to fetch
  // it cross-origin, so it works even for image hosts (like stock-photo
  // CDNs) that block that kind of request outright.
  const uploadLabel = document.createElement("label");
  uploadLabel.className = "builder-image-upload-label";
  uploadLabel.textContent = field.src?.startsWith("data:") ? "Uploaded image ✓ — replace: " : "Or upload an image: ";
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "image/png, image/jpeg";
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    uploadInput.value = "";
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    field.src = dataUrl;
    onLightChange();
  });
  uploadLabel.appendChild(uploadInput);

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
  wrap.appendChild(uploadLabel);
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

function renderFieldRow({ field, index, fieldCount, state, worksheetId, sectionId, typeSelect, onChange, onLightChange }) {
  const row = document.createElement("div");
  row.className = "builder-field-row";
  row.dataset.fieldId = field.id;

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

  if (IMAGE_FIELD_TYPES.has(field.type)) {
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

  if (OPTIONS_FIELD_TYPES.has(field.type)) {
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

  // Inserts right after THIS question, in the same column as this question
  // — separate from the per-column "add to the end of this column" control
  // below, which is always a end-of-stack append.
  const insertBtn = document.createElement("button");
  insertBtn.type = "button";
  insertBtn.className = "builder-insert-field-btn";
  insertBtn.textContent = "+ Insert question here";
  insertBtn.title = "Insert a new question of the selected type right after this one";
  insertBtn.addEventListener("click", () => {
    state.addField(worksheetId, sectionId, buildDefaultFieldConfig(typeSelect.value, field.column), index + 1);
    onChange();
  });
  row.appendChild(insertBtn);

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
          typeSelect,
          onChange,
          onLightChange,
        })
      );
    }

    const insertIndex = column.length ? column[column.length - 1].index + 1 : fieldCount;
    const addRow = document.createElement("div");
    addRow.className = "builder-add-field-row";

    const addToColumnBtn = document.createElement("button");
    addToColumnBtn.type = "button";
    addToColumnBtn.className = "builder-add-field-btn builder-add-to-column-btn";
    addToColumnBtn.textContent = "+ Add question";
    addToColumnBtn.title = "Add a new question of the selected type to the end of this column";
    addToColumnBtn.addEventListener("click", () => {
      state.addField(worksheetId, sectionId, buildDefaultFieldConfig(typeSelect.value, columnIndex), insertIndex);
      onChange();
    });

    addRow.appendChild(typeSelect);
    addRow.appendChild(addToColumnBtn);
    columnEl.appendChild(addRow);

    fieldList.appendChild(columnEl);
  });

  container.appendChild(fieldList);
}
