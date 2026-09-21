import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StorageManager } from "../../src/core/storage.js";

describe("StorageManager", () => {
  it("uses IndexedDB as the primary backend when available", async () => {
    const store = new StorageManager({ keyPrefix: "test-idb:" });
    await store.set("answer", { hello: "world" });
    expect(await store.backendName()).toBe("indexeddb");
    expect(await store.get("answer")).toEqual({ hello: "world" });
  });

  it("returns null for a missing key", async () => {
    const store = new StorageManager({ keyPrefix: "test-missing:" });
    expect(await store.get("nope")).toBeNull();
  });

  it("overwrites an existing value", async () => {
    const store = new StorageManager({ keyPrefix: "test-overwrite:" });
    await store.set("k", 1);
    await store.set("k", 2);
    expect(await store.get("k")).toBe(2);
  });

  it("deletes a value", async () => {
    const store = new StorageManager({ keyPrefix: "test-delete:" });
    await store.set("k", 1);
    await store.delete("k");
    expect(await store.get("k")).toBeNull();
  });

  it("keeps separate namespaces isolated by keyPrefix", async () => {
    const a = new StorageManager({ keyPrefix: "ns-a:" });
    const b = new StorageManager({ keyPrefix: "ns-b:" });
    await a.set("k", "from-a");
    await b.set("k", "from-b");
    expect(await a.get("k")).toBe("from-a");
    expect(await b.get("k")).toBe("from-b");
  });

  describe("fallback chain when IndexedDB is unavailable", () => {
    let originalIndexedDb;

    beforeEach(() => {
      originalIndexedDb = globalThis.indexedDB;
      // simulate a browser/environment where IndexedDB throws or is missing
      // eslint-disable-next-line no-global-assign
      globalThis.indexedDB = undefined;
    });

    afterEach(() => {
      globalThis.indexedDB = originalIndexedDb;
    });

    it("falls back to localStorage", async () => {
      const store = new StorageManager({ keyPrefix: "test-fallback-ls:" });
      await store.set("k", { v: 1 });
      expect(await store.backendName()).toBe("localstorage");
      expect(await store.get("k")).toEqual({ v: 1 });
    });
  });

  describe("fallback chain when neither IndexedDB nor localStorage are available", () => {
    let originalIndexedDb;
    let originalLocalStorage;

    beforeEach(() => {
      originalIndexedDb = globalThis.indexedDB;
      originalLocalStorage = globalThis.localStorage;
      // eslint-disable-next-line no-global-assign
      globalThis.indexedDB = undefined;
      Object.defineProperty(globalThis, "localStorage", {
        value: undefined,
        configurable: true,
      });
    });

    afterEach(() => {
      globalThis.indexedDB = originalIndexedDb;
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
      });
    });

    it("falls back to an in-memory store", async () => {
      const store = new StorageManager({ keyPrefix: "test-fallback-mem:" });
      await store.set("k", { v: 42 });
      expect(await store.backendName()).toBe("memory");
      expect(await store.get("k")).toEqual({ v: 42 });
    });
  });
});
