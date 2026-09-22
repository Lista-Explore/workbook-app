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
        for (const f of s.fields || []) this._usedFieldIds.add(f.id);
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
    // A brand-new worksheet starts with one section already in it — not
    // empty — so a designer can go straight to "+ Add question" instead of
    // first having to click "+ Add section" for a worksheet that obviously
    // needs at least one anyway.
    this.addSection(id);
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

  reorderSection(worksheetId, sectionId, newIndex) {
    const worksheet = this._findWorksheet(worksheetId);
    const from = worksheet.sections.findIndex((s) => s.id === sectionId);
    if (from === -1) return;
    const [item] = worksheet.sections.splice(from, 1);
    worksheet.sections.splice(newIndex, 0, item);
  }

  /**
   * Adds a field to a section. By default it's appended to the end; pass
   * `insertIndex` to insert it at a specific position instead (e.g. right
   * after the question the designer was looking at), so inserting into the
   * middle of a long list never requires re-adding and re-ordering
   * everything after it.
   */
  addField(worksheetId, sectionId, fieldConfig, insertIndex) {
    const section = this._findSection(worksheetId, sectionId);
    const id = generateId(fieldConfig.label, section.fields.length, this._usedFieldIds);
    const field = { id, required: false, ...fieldConfig };
    if (insertIndex == null || insertIndex >= section.fields.length) {
      section.fields.push(field);
    } else {
      section.fields.splice(Math.max(insertIndex, 0), 0, field);
    }
    return field;
  }

  removeField(worksheetId, sectionId, fieldId) {
    const section = this._findSection(worksheetId, sectionId);
    section.fields = section.fields.filter((f) => f.id !== fieldId);
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
    return JSON.parse(JSON.stringify(this.workbook));
  }
}
