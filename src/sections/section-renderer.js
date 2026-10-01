import { FieldRegistry } from "../fields/registry.js";
import { groupByColumn, groupByBlockThenColumn } from "../core/column-layout.js";

/**
 * Renders a section: a collapsible <details>/<summary> wrapper (every
 * named section uses this), or a plain wrapper for standalone questions.
 * The fields area is laid
 * out in 1/2/3 columns. Columns are genuine independent vertical
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
  // Standalone questions have no disclosure banner or collapse behavior.
  const container = document.createElement(section.unsectioned ? "div" : "details");
  container.className = "wb-section";
  container.dataset.sectionId = section.id;

  if (section.unsectioned) container.dataset.unsectioned = "true";

  if (!section.unsectioned) {
    if (!section.startCollapsed) container.open = true;
    const summary = document.createElement("summary");
    // "content-summary" is the LMS's own disclosure-banner class — reusing
    // it here (rather than inventing our own look) means this picks up that
    // design automatically wherever the host page's own stylesheet is
    // already loaded, with no new visual CSS of our own.
    summary.className = "wb-section-title content-summary";
    const titleWrap = document.createElement("div");
    titleWrap.textContent = section.title || "";
    summary.appendChild(titleWrap);
    container.appendChild(summary);
  }

  const renderColumns = (columnCount, columns) => {
    const fieldsContainer = document.createElement("div");
    fieldsContainer.className = "wb-section-fields";
    fieldsContainer.dataset.columns = String(columnCount);

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
  };

  // A named section can hold more than one layout block — each with its own
  // column count, authored in the Builder via "+ Start new layout in this
  // section" — rendered here as separate .wb-section-fields stacked under
  // the one shared collapsible banner. A section without extra blocks (the
  // vast majority) renders exactly as before: a single block.
  const blockColumnCounts = !section.unsectioned && Array.isArray(section.blocks) && section.blocks.length
    ? section.blocks
    : [section.columns || 1];

  if (blockColumnCounts.length > 1) {
    const blocks = groupByBlockThenColumn(section.fields || [], blockColumnCounts, (field) => field.block, (field) => field.column);
    for (const { columnCount, columns } of blocks) renderColumns(columnCount, columns);
  } else {
    const columnCount = blockColumnCounts[0];
    const columns = groupByColumn(section.fields || [], columnCount, (field) => field.column);
    renderColumns(columnCount, columns);
  }

  return container;
}
