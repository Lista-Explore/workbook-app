import { describe, it, expect } from "vitest";
import { BuilderDraftStore } from "../../builder/src/builder-storage.js";
import { createWorkbookStorage } from "../../src/core/storage.js";

describe("BuilderDraftStore", () => {
  it("saves and loads a draft workbook definition", async () => {
    const store = new BuilderDraftStore("wb-draft-test");
    await store.save({ id: "wb-draft-test", title: "Draft" });
    expect(await store.load()).toEqual({ id: "wb-draft-test", title: "Draft" });
  });

  it("returns null when no draft has been saved", async () => {
    const store = new BuilderDraftStore("wb-draft-empty");
    expect(await store.load()).toBeNull();
  });

  it("clear() removes the draft", async () => {
    const store = new BuilderDraftStore("wb-draft-clear");
    await store.save({ id: "wb-draft-clear" });
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("uses a namespace isolated from student runtime data with the same workbook id", async () => {
    const draftStore = new BuilderDraftStore("wb-shared-id");
    const studentStorage = createWorkbookStorage("wb-shared-id");

    await draftStore.save({ id: "wb-shared-id", title: "Draft version" });
    await studentStorage.set("state", { worksheets: { ws1: { a: "student answer" } } });

    expect(await draftStore.load()).toEqual({ id: "wb-shared-id", title: "Draft version" });
    expect(await studentStorage.get("state")).toEqual({ worksheets: { ws1: { a: "student answer" } } });
  });
});
