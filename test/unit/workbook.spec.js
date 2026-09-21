import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Workbook, LMSWorkbook } from "../../src/core/workbook.js";
import { registerAllFields } from "../../src/fields/index.js";

beforeAll(() => {
  registerAllFields();
});

beforeEach(() => {
  LMSWorkbook._reset();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

const config = {
  id: "wb-test",
  title: "Test Workbook",
  worksheets: [
    {
      id: "ws1",
      title: "Worksheet 1",
      sections: [{ id: "s1", fields: [{ id: "name", type: "short-text", label: "Name", required: true }] }],
    },
  ],
};

describe("Workbook", () => {
  it("mounts and renders into the given element", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook(config);
    await wb.mount(mount);
    expect(mount.querySelector(".lms-workbook, .wb-root")).not.toBeNull();
  });

  it("autosaves a field change after the debounce delay", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook({ ...config, id: "wb-autosave" });
    await wb.mount(mount);

    const input = mount.querySelector("#name");
    input.value = "Acme";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(wb.getData().worksheets.ws1.name).toBe("Acme");

    await vi.advanceTimersByTimeAsync(500);

    const persisted = await wb.storage.get("state");
    expect(persisted.worksheets.ws1.name).toBe("Acme");
  });

  it("restores previously saved data on mount", async () => {
    const wb1 = new Workbook({ ...config, id: "wb-restore" });
    await wb1.storage.set("state", {
      workbookId: "wb-restore",
      version: 1,
      updatedAt: new Date().toISOString(),
      worksheets: { ws1: { name: "Restored" } },
    });

    const mount = document.createElement("div");
    const wb2 = new Workbook({ ...config, id: "wb-restore" }, { storage: wb1.storage });
    await wb2.mount(mount);

    expect(mount.querySelector("#name").value).toBe("Restored");
  });

  it("validate() reports missing required fields", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook({ ...config, id: "wb-validate" });
    await wb.mount(mount);
    expect(wb.validate()).toHaveLength(1);
  });

  it("clear() resets data and storage", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook({ ...config, id: "wb-clear" });
    await wb.mount(mount);
    const input = mount.querySelector("#name");
    input.value = "Acme";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wb.flushPendingSave();

    await wb.clear();
    expect(wb.getData().worksheets).toEqual({});
    expect(await wb.storage.get("state")).toBeNull();
  });

  it("emits a 'change' event on field edits", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook({ ...config, id: "wb-events" });
    await wb.mount(mount);
    const cb = vi.fn();
    wb.on("change", cb);
    const input = mount.querySelector("#name");
    input.value = "X";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith({ worksheetId: "ws1", fieldId: "name", value: "X" });
  });

  it("progress() reflects the answered state", async () => {
    const mount = document.createElement("div");
    const wb = new Workbook({ ...config, id: "wb-progress" });
    await wb.mount(mount);
    expect(wb.progress().percent).toBe(0);
    const input = mount.querySelector("#name");
    input.value = "Acme";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(wb.progress().percent).toBe(100);
  });
});

describe("LMSWorkbook registry", () => {
  it("registers and retrieves a workbook by id", () => {
    const instance = LMSWorkbook.register(config);
    expect(LMSWorkbook.get("wb-test")).toBe(instance);
  });

  it("throws a clear error for an unregistered id", () => {
    expect(() => LMSWorkbook.get("nope")).toThrow(/has not been registered/);
  });
});
