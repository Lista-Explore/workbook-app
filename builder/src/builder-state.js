import { migrateContentField, repairContentHtmlSpacing, repairPdfTextSpacing } from "../../src/fields/content.js";
import { generateId, slugify } from "../../src/core/id-generator.js";

function emptyWorkbook() {
  return {
    id: "",
    title: "",
    worksheets: [],
  };
}

/**
 * In-memory model of the workbook being authored in the Builder. Every
 * mutation is a plain method call driven by a UI click/select/type —
 * there is no code or JSON for the designer to touch.
 */
export class BuilderState {
  constructor(initial) {
    this.load(initial || emptyWorkbook());
  }

  /**
   * Replaces the whole in-progress workbook (e.g. restoring a saved draft)
   * and rebuilds the used-id tracking to match it. Callers should always go
   * through this rather than assigning `state.workbook` directly — a raw
   * assignment leaves the used-id sets stale, risking id collisions on the
   * next add.
   */
  load(workbook) {
    this.workbook = workbook;
    this._usedWorksheetIds = new Set(this.workbook.worksheets.map((w) => w.id));
    this._usedSectionIds = new Set();
    this._usedFieldIds = new Set();
    for (const ws of this.workbook.worksheets) {
      for (const s of ws.sections || []) {
        this._usedSectionIds.add(s.id);
        for (const f of s.fields || []) {
          migrateContentField(f);
          normalizeAuthorField(f);
          this._usedFieldIds.add(f.id);
        }
      }
    }
  }

  /** Discards everything and starts a brand-new, empty workbook. */
  reset() {
    this.load(emptyWorkbook());
  }

  /**
   * Like every other id in this model (worksheet/section/field), the
   * workbook's own id is derived from its label — here, the title — the
   * first time it's set, then stays fixed even if the title is edited
   * again later, so a published mount snippet or downloaded PDF never goes
   * stale just because the designer tweaked the title.
   */
  setTitle(title) {
    this.workbook.title = title;
    if (!this.workbook.id && title.trim()) {
      this.workbook.id = slugify(title);
    }
  }

  /** Escape hatch for setting the id directly (e.g. publishing under a specific, pre-agreed id). */
  setId(id) {
    this.workbook.id = id;
  }

  addWorksheet(title = "New worksheet") {
    const id = generateId(title, this.workbook.worksheets.length, this._usedWorksheetIds);
    const worksheet = { id, title, sections: [] };
    this.workbook.worksheets.push(worksheet);
    return worksheet;
  }

  removeWorksheet(worksheetId) {
    this.workbook.worksheets = this.workbook.worksheets.filter((w) => w.id !== worksheetId);
  }

  reorderWorksheet(worksheetId, newIndex) {
    const list = this.workbook.worksheets;
    const from = list.findIndex((w) => w.id === worksheetId);
    if (from === -1) return;
    const [item] = list.splice(from, 1);
    list.splice(newIndex, 0, item);
  }

  _findWorksheet(worksheetId) {
    const worksheet = this.workbook.worksheets.find((w) => w.id === worksheetId);
    if (!worksheet) throw new Error(`Worksheet "${worksheetId}" not found.`);
    return worksheet;
  }

  addSection(worksheetId, { title = "New section", columns = 1 } = {}) {
    const worksheet = this._findWorksheet(worksheetId);
    const id = generateId(title, worksheet.sections.length, this._usedSectionIds);
    // Every section uses the collapsible element — not a per-section choice.
    const section = { id, title, columns, collapsible: true, startCollapsed: false, fields: [] };
    worksheet.sections.push(section);
    return section;
  }

  addStandaloneSection(worksheetId, { columns = 1, afterSectionId } = {}) {
    const worksheet = this._findWorksheet(worksheetId);
    const id = generateId("questions", worksheet.sections.length, this._usedSectionIds);
    const section = { id, title: "", columns, unsectioned: true, fields: [] };
    const afterIndex = afterSectionId
      ? worksheet.sections.findIndex((s) => s.id === afterSectionId)
      : -1;
    if (afterIndex === -1) worksheet.sections.push(section);
    else worksheet.sections.splice(afterIndex + 1, 0, section);
    return section;
  }

  removeSection(worksheetId, sectionId) {
    const worksheet = this._findWorksheet(worksheetId);
    worksheet.sections = worksheet.sections.filter((s) => s.id !== sectionId);
  }

  updateSection(worksheetId, sectionId, patch) {
    const section = this._findSection(worksheetId, sectionId);
    Object.assign(section, patch);
  }

  _findSection(worksheetId, sectionId) {
    const worksheet = this._findWorksheet(worksheetId);
    const section = worksheet.sections.find((s) => s.id === sectionId);
    if (!section) throw new Error(`Section "${sectionId}" not found.`);
    return section;
  }

  /**
   * Adds a new layout block to a named section, giving it its own column
   * count independent of the section's existing block(s) — the in-section
   * equivalent of stacking a second standalone no-section layout. The
   * section's pre-existing single column count becomes block 0 the first
   * time this is called, so earlier questions (all implicitly block 0)
   * keep rendering exactly as before.
   */
  addSectionLayoutBlock(worksheetId, sectionId) {
    const section = this._findSection(worksheetId, sectionId);
    if (!Array.isArray(section.blocks) || !section.blocks.length) section.blocks = [section.columns || 1];
    section.blocks.push(1);
    return section.blocks.length - 1;
  }

  /**
   * Sets a layout block's column count. Block 0's count is kept mirrored
   * onto `section.columns` so code that still only knows about the legacy
   * single-column-count shape (e.g. a section with no extra blocks) keeps
   * reading the right value.
   */
  updateSectionBlock(worksheetId, sectionId, blockIndex, columns) {
    const section = this._findSection(worksheetId, sectionId);
    if (!Array.isArray(section.blocks) || !section.blocks.length) section.blocks = [section.columns || 1];
    section.blocks[blockIndex] = columns;
    if (blockIndex === 0) section.columns = columns;
  }

  /**
   * Removes a layout block, moving its questions up into the previous
   * block (or block 0 if it was the first extra block) rather than
   * deleting them.
   */
  removeSectionBlock(worksheetId, sectionId, blockIndex) {
    const section = this._findSection(worksheetId, sectionId);
    if (!Array.isArray(section.blocks) || section.blocks.length <= 1) return;
    const targetBlock = Math.max(blockIndex - 1, 0);
    for (const field of section.fields || []) {
      const fieldBlock = Number.isInteger(field.block) ? field.block : 0;
      if (fieldBlock === blockIndex) field.block = targetBlock;
      else if (fieldBlock > blockIndex) field.block = fieldBlock - 1;
    }
    section.blocks.splice(blockIndex, 1);
    if (section.blocks.length <= 1) section.columns = section.blocks[0];
  }

  reorderSection(worksheetId, sectionId, newIndex) {
    const worksheet = this._findWorksheet(worksheetId);
    const from = worksheet.sections.findIndex((s) => s.id === sectionId);
    if (from === -1) return;
    const [item] = worksheet.sections.splice(from, 1);
    worksheet.sections.splice(newIndex, 0, item);
  }

  /**
   * Adds a field to a section, or directly to the worksheet when sectionId
   * is null. By default it's appended to the end; pass
   * `insertIndex` to insert it at a specific position instead (e.g. right
   * after the question the designer was looking at), so inserting into the
   * middle of a long list never requires re-adding and re-ordering
   * everything after it.
   */
  addField(worksheetId, sectionId, fieldConfig, insertIndex) {
    // Standalone questions retain the existing field pipeline in an untitled,
    // non-disclosing group, created only when the first question is added.
    let section;
    if (sectionId == null) {
      section = this._addStandaloneSection(worksheetId, fieldConfig._sectionColumns || 1);
      delete fieldConfig._sectionColumns;
    } else {
      section = this._findSection(worksheetId, sectionId);
    }
    const id = generateId(fieldConfig.label, section.fields.length, this._usedFieldIds);
    const field = { id, required: false, ...fieldConfig };
    if (insertIndex == null || insertIndex >= section.fields.length) {
      section.fields.push(field);
    } else {
      section.fields.splice(Math.max(insertIndex, 0), 0, field);
    }
    return field;
  }


  _addStandaloneSection(worksheetId, columns = 1) {
    return this.addStandaloneSection(worksheetId, { columns });
  }

  /**
   * Moves existing fields between standalone questions and sections without
   * changing their ids or field-specific settings. Destination column (and,
   * for a named section with more than one layout block, destination block)
   * is applied at the target so moving into a multi-column section — or a
   * specific layout block within it — is explicit.
   */
  moveFields(worksheetId, fieldIds, destinationSectionId, destinationColumn = 0, insertIndex, destinationBlock = 0) {
    const worksheet = this._findWorksheet(worksheetId);
    const ids = [...new Set(fieldIds)].filter(Boolean);
    if (!ids.length) return;

    const moved = [];
    for (const section of worksheet.sections) {
      const remaining = [];
      for (const field of section.fields || []) {
        if (ids.includes(field.id)) moved.push(field);
        else remaining.push(field);
      }
      section.fields = remaining;
    }
    if (!moved.length) return;

    let destination = destinationSectionId == null
      ? this._addStandaloneSection(worksheetId, Math.max(Number(destinationColumn) + 1 || 1, 1))
      : this._findSection(worksheetId, destinationSectionId);

    const blockColumnCounts = !destination.unsectioned && Array.isArray(destination.blocks) && destination.blocks.length
      ? destination.blocks
      : [destination.columns || 1];
    const safeBlock = Math.min(Math.max(Number(destinationBlock) || 0, 0), blockColumnCounts.length - 1);
    const maxColumn = Math.max((blockColumnCounts[safeBlock] || 1) - 1, 0);
    const safeColumn = Math.min(Math.max(Number(destinationColumn) || 0, 0), maxColumn);
    moved.forEach((field) => {
      field.column = safeColumn;
      if (blockColumnCounts.length > 1) field.block = safeBlock;
    });

    const targetIndex = insertIndex == null
      ? destination.fields.length
      : Math.min(Math.max(insertIndex, 0), destination.fields.length);
    destination.fields.splice(targetIndex, 0, ...moved);

    worksheet.sections = worksheet.sections.filter((section) => !section.unsectioned || section.fields.length > 0);
  }

  removeField(worksheetId, sectionId, fieldId) {
    const section = this._findSection(worksheetId, sectionId);
    section.fields = section.fields.filter((f) => f.id !== fieldId);
    if (section.unsectioned && section.fields.length === 0) {
      this.removeSection(worksheetId, sectionId);
    }
  }

  updateField(worksheetId, sectionId, fieldId, patch) {
    const section = this._findSection(worksheetId, sectionId);
    const field = section.fields.find((f) => f.id === fieldId);
    if (!field) throw new Error(`Field "${fieldId}" not found.`);
    Object.assign(field, patch);
  }

  reorderField(worksheetId, sectionId, fieldId, newIndex) {
    const section = this._findSection(worksheetId, sectionId);
    const from = section.fields.findIndex((f) => f.id === fieldId);
    if (from === -1) return;
    const [item] = section.fields.splice(from, 1);
    section.fields.splice(newIndex, 0, item);
  }

  toConfig() {
    const config = JSON.parse(JSON.stringify(this.workbook));
    for (const worksheet of config.worksheets || []) {
      worksheet.sections = (worksheet.sections || []).filter((section) => {
        return !section.unsectioned || (section.fields || []).length > 0;
      });
    }
    return config;
  }
}

function normalizeAuthorField(field) {
  if (field.type === "content" && field.html) {
    field.html = repairContentHtmlSpacing(field.html);
  }
  if (Array.isArray(field.options)) {
    field.options = field.options.map((option) => repairPdfTextSpacing(option));
  }
  if (Array.isArray(field.optionsHtml)) {
    field.optionsHtml = field.optionsHtml.map((html) => (html ? repairContentHtmlSpacing(html) : html));
  }
  if (field.label) {
    field.label = repairPdfTextSpacing(field.label);
  }
}
