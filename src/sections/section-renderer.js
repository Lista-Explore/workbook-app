import { FieldRegistry } from "../fields/registry.js";
import { groupByColumn } from "../core/column-layout.js";

/**
 * Renders a section: an optional collapsible wrapper, and a fields area
 * laid out in 1/2/3 columns. Columns are genuine independent vertical
 * stacks, based on each field's own stored `column` index — not a
 * left-right grid of pairs, and not recomputed from the total field count
 * (which would reshuffle other columns' contents every time a field is
 * added or removed anywhere in the section). Images
 * are just another field type (like heading/instructions/statement),
 * inserted into `section.fields` wherever the designer put them, not a
 * separate section-level slot.
 *
 * `values` is a plain object of { fieldId: value } used to pre-fill fields.
 * `onFieldChange(fieldId, value)` is called whenever a field's value changes.
 */
export function renderSection(section, { values = {}, onFieldChange } = {}) {
  const isCollapsible = Boolean(section.collapsible);
  const container = document.createElement(isCollapsible ? "details" : "div");
  container.className = "wb-section";
  container.dataset.sectionId = section.id;

  if (isCollapsible) {
    if (!section.startCollapsed) container.open = true;
    const summary = document.createElement("summary");
    summary.className = "wb-section-title";
    summary.textContent = section.title || "";
    container.appendChild(summary);
  } else if (section.title) {
    const title = document.createElement("h2");
    title.className = "wb-section-title";
    title.textContent = section.title;
    container.appendChild(title);
  }

  const fieldsContainer = document.createElement("div");
  fieldsContainer.className = "wb-section-fields";
  const columnCount = section.columns || 1;
  fieldsContainer.dataset.columns = String(columnCount);

  const columns = groupByColumn(section.fields || [], columnCount, (field) => field.column);

  for (const column of columns) {
    const columnEl = document.createElement("div");
    columnEl.className = "wb-column";

    for (const { item: field } of column) {
      const module = FieldRegistry.get(field.type);
      const fieldEl = module.render(field, values[field.id]);
      columnEl.appendChild(fieldEl);

      if (onFieldChange) {
        fieldEl.addEventListener("input", () => {
          onFieldChange(field.id, module.getValue(fieldEl));
        });
        fieldEl.addEventListener("change", () => {
          onFieldChange(field.id, module.getValue(fieldEl));
        });
      }
    }

    fieldsContainer.appendChild(columnEl);
  }

  container.appendChild(fieldsContainer);

  return container;
}
