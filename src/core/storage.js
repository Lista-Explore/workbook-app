const DB_NAME = "lms-workbook-store";
const DB_VERSION = 1;
const STORE_NAME = "workbooks";

function openIndexedDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function idbGet(key) {
  const db = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
  });
}

async function idbSet(key, value) {
  const db = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB put failed"));
  });
}

async function idbDelete(key) {
  const db = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
  });
}

const memoryStore = new Map();

/**
 * Storage manager with an IndexedDB -> localStorage -> in-memory fallback chain.
 * The backend that succeeds first is cached per-key-prefix for subsequent calls
 * in the same session, so we don't retry a broken backend on every write.
 */
export class StorageManager {
  constructor({ keyPrefix = "" } = {}) {
    this.keyPrefix = keyPrefix;
    this.backend = null;
  }

  _fullKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  async _resolveBackend() {
    if (this.backend) return this.backend;
    try {
      await idbSet(this._fullKey("__probe__"), 1);
      await idbDelete(this._fullKey("__probe__"));
      this.backend = "indexeddb";
      if (navigator.storage && navigator.storage.persist) {
        try {
          await navigator.storage.persist();
        } catch {
          // best-effort only
        }
      }
      return this.backend;
    } catch {
      // fall through
    }
    try {
      if (typeof localStorage === "undefined") throw new Error("no localStorage");
      const probeKey = this._fullKey("__probe__");
      localStorage.setItem(probeKey, "1");
      localStorage.removeItem(probeKey);
      this.backend = "localstorage";
      return this.backend;
    } catch {
      // fall through
    }
    this.backend = "memory";
    return this.backend;
  }

  async get(key) {
    const backend = await this._resolveBackend();
    const fullKey = this._fullKey(key);
    if (backend === "indexeddb") {
      try {
        return await idbGet(fullKey);
      } catch {
        this.backend = "memory";
        return memoryStore.has(fullKey) ? memoryStore.get(fullKey) : null;
      }
    }
    if (backend === "localstorage") {
      const raw = localStorage.getItem(fullKey);
      return raw ? JSON.parse(raw) : null;
    }
    return memoryStore.has(fullKey) ? memoryStore.get(fullKey) : null;
  }

  async set(key, value) {
    const backend = await this._resolveBackend();
    const fullKey = this._fullKey(key);
    if (backend === "indexeddb") {
      try {
        await idbSet(fullKey, value);
        return;
      } catch {
        this.backend = "memory";
      }
    }
    if (this.backend === "localstorage") {
      try {
        localStorage.setItem(fullKey, JSON.stringify(value));
        return;
      } catch {
        this.backend = "memory";
      }
    }
    memoryStore.set(fullKey, value);
  }

  async delete(key) {
    const backend = await this._resolveBackend();
    const fullKey = this._fullKey(key);
    if (backend === "indexeddb") {
      try {
        await idbDelete(fullKey);
        return;
      } catch {
        this.backend = "memory";
      }
    }
    if (this.backend === "localstorage") {
      localStorage.removeItem(fullKey);
      return;
    }
    memoryStore.delete(fullKey);
  }

  async backendName() {
    return this._resolveBackend();
  }
}

export function createWorkbookStorage(workbookId) {
  return new StorageManager({ keyPrefix: `wb:${workbookId}:` });
}

export function createBuilderStorage(workbookId) {
  return new StorageManager({ keyPrefix: `draft:${workbookId}:` });
}

export function createPreviewStorage(workbookId) {
  return new StorageManager({ keyPrefix: `preview:${workbookId}:` });
}

export function createPublishedStorage(workbookId) {
  return new StorageManager({ keyPrefix: `published:${workbookId}:` });
}
