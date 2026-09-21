import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { renderWorkbook } from "../../src/core/renderer.js";
import { registerAllFields } from "../../src/fields/index.js";
import { hydrateWorkbook } from "../../src/core/hydrate.js";
import { createWorkbookStorage } from "../../src/core/storage.js";

beforeAll(() => {
  registerAllFields();
});

beforeEach(() => {
  // Each test gets its own workbook id, so storage never leaks across tests.
});

const config = (id) => ({
  id,
  title: "Hydrate Test",
  worksheets: [
    {
      id: "ws1",
      sections: [
        {
          id: "s1",
          fields: [{ id: "name", type: "short-text", label: "Your name?", required: true, column: 0 }],
        },
      ],
    },
  ],
});

function mountStatic(id) {
  const mount = document.createElement("div");
  mount.dataset.workbook = id;
  renderWorkbook(config(id), mount);
  document.body.appendChild(mount);
  return mount;
}

describe("hydrateWorkbook", () => {
  it("adds the download/upload/reset controls to the already-rendered HTML", async () => {
    const mount = mountStatic("hydrate-controls");
    await hydrateWorkbook(mount);
    expect(mount.querySelector("#wb-download-pdf-btn")).not.toBeNull();
    expect(mount.querySelector("#wb-reset-btn")).not.toBeNull();
  });

  it("autosaves a typed value and restores it after re-rendering + re-hydrating", async () => {
    const id = "hydrate-autosave";
    const mount = mountStatic(id);
    await hydrateWorkbook(mount);

    const input = mount.querySelector("#name");
    input.value = "Ada";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await vi.waitFor(async () => {
      const saved = await createWorkbookStorage(id).get("state");
      expect(saved?.worksheets?.default?.name).toBe("Ada");
    });

    // Simulate a fresh page load: render the same static HTML again, hydrate again.
    const mount2 = mountStatic(id);
    await hydrateWorkbook(mount2);
    expect(mount2.querySelector("#name").value).toBe("Ada");
  });

  it("clear() blanks the field and removes the saved state", async () => {
    const id = "hydrate-clear";
    const mount = mountStatic(id);
    await hydrateWorkbook(mount);

    const input = mount.querySelector("#name");
    input.value = "Ada";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(async () => {
      const saved = await createWorkbookStorage(id).get("state");
      expect(saved?.worksheets?.default?.name).toBe("Ada");
    });

    mount.querySelector("#wb-reset-btn").click();
    await vi.waitFor(async () => {
      const saved = await createWorkbookStorage(id).get("state");
      expect(saved).toBeNull();
    });
    expect(mount.querySelector("#name").value).toBe("");
  });

  it("does nothing for an element with no data-workbook id", async () => {
    const mount = document.createElement("div");
    renderWorkbook(config(""), mount);
    delete mount.dataset.workbook;
    const result = await hydrateWorkbook(mount);
    expect(result).toBeNull();
  });
});
