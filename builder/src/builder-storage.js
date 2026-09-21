import { createBuilderStorage } from "../../src/core/storage.js";

/**
 * Autosaves the in-progress workbook definition under a `draft:` namespace,
 * completely separate from any student's answer data (which lives under
 * `wb:`) and from Preview's own `preview:` namespace.
 */
export class BuilderDraftStore {
  constructor(workbookId) {
    this.storage = createBuilderStorage(workbookId);
  }

  async save(config) {
    await this.storage.set("draft", config);
  }

  async load() {
    return this.storage.get("draft");
  }

  async clear() {
    await this.storage.delete("draft");
  }
}
