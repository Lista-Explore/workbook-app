import { createWorkbookStorage } from "./storage.js";
import { renderWorkbook } from "./renderer.js";
import { renderWorkbookControls } from "./controls.js";
import { validateWorkbook } from "./validation.js";
import { computeProgress } from "./progress.js";
import { Emitter } from "./events.js";
import { exportWorkbookPdf } from "../pdf/pdf-export.js";
import { importWorkbookPdf } from "../pdf/pdf-import.js";

const AUTOSAVE_DELAY_MS = 400;
const STATE_VERSION = 1;
const instances = new Map();

function emptyState(workbookId) {
  return {
    workbookId,
    version: STATE_VERSION,
    updatedAt: new Date().toISOString(),
    worksheets: {},
  };
}

function debounce(fn, delay) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return debounced;
}

/**
 * Creates (or returns the existing) Runtime instance for a workbook config.
 * `storage` can be overridden (e.g. for a Builder preview's isolated namespace).
 */
export class Workbook {
  constructor(config, { storage } = {}) {
    this.config = config;
    this.storage = storage || createWorkbookStorage(config.id);
    this.emitter = new Emitter();
    this.data = emptyState(config.id);
    this.mountEl = null;
    this.handle = null;
    this._saveDebounced = debounce(() => this._persist(), AUTOSAVE_DELAY_MS);
  }

  async _persist() {
    this.data.updatedAt = new Date().toISOString();
    await this.storage.set("state", this.data);
    this.emitter.emit("save", this.getData());
  }

  async _loadInitial() {
    const stored = await this.storage.get("state");
    if (stored) this.data = stored;
  }

  async mount(mountEl) {
    this.mountEl = mountEl;
    await this._loadInitial();
    this._render();
    this.emitter.emit("mount", this.getData());
    return this;
  }

  _render() {
    this.handle = renderWorkbook(this.config, this.mountEl, {
      data: this.data,
      onFieldChange: (worksheetId, fieldId, value) => {
        if (!this.data.worksheets[worksheetId]) this.data.worksheets[worksheetId] = {};
        this.data.worksheets[worksheetId][fieldId] = value;
        this.emitter.emit("change", { worksheetId, fieldId, value });
        this._saveDebounced();
      },
    });
    // renderWorkbook() clears mountEl on every call, so the controls bar is
    // rebuilt alongside it rather than appended once and orphaned.
    this.mountEl.appendChild(renderWorkbookControls(this));
  }

  getData() {
    return JSON.parse(JSON.stringify(this.data));
  }

  async setData(data) {
    this.data = {
      ...emptyState(this.config.id),
      ...data,
      worksheets: { ...(data && data.worksheets) },
    };
    if (this.mountEl) this._render();
    await this._persist();
  }

  async clear() {
    this.data = emptyState(this.config.id);
    await this.storage.delete("state");
    if (this.mountEl) this._render();
    this.emitter.emit("clear");
  }

  validate() {
    return validateWorkbook(this.config, this.data);
  }

  progress() {
    return computeProgress(this.config, this.data);
  }

  on(event, callback) {
    return this.emitter.on(event, callback);
  }

  async flushPendingSave() {
    await this._saveDebounced.flush();
  }

  async exportPDF() {
    await this.flushPendingSave();
    return exportWorkbookPdf(this.config, this.data);
  }

  async importPDF(pdfBytes) {
    const result = await importWorkbookPdf(this.config, pdfBytes, this.data);
    await this.setData(result.data);
    return result;
  }
}

export const LMSWorkbook = {
  register(config) {
    instances.set(config.id, new Workbook(config));
    return instances.get(config.id);
  },
  get(id) {
    const instance = instances.get(id);
    if (!instance) throw new Error(`Workbook "${id}" has not been registered.`);
    return instance;
  },
  has(id) {
    return instances.has(id);
  },
  _reset() {
    instances.clear();
  },
};
