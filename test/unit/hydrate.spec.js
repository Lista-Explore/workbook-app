import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { renderWorkbook } from "../../src/core/renderer.js";
import { registerAllFields } from "../../src/fields/index.js";
import { hydrateWorkbook, hydrateAllWorkbooks } from "../../src/core/hydrate.js";
import { createWorkbookStorage } from "../../src/core/storage.js";
import { PDFDocument } from "../../src/vendor/pdf-lib.esm.js";

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
      expect(saved?.worksheets?.["worksheet-0"]?.name).toBe("Ada");
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
      expect(saved?.worksheets?.["worksheet-0"]?.name).toBe("Ada");
    });

    mount.querySelector("#wb-reset-btn").click();
    await vi.waitFor(async () => {
      const saved = await createWorkbookStorage(id).get("state");
      expect(saved).toBeNull();
    });
    expect(mount.querySelector("#name").value).toBe("");
  });

  it("still hydrates when data-workbook is missing, falling back to the title", async () => {
    const mount = document.createElement("div");
    mount.className = "lms-workbook";
    renderWorkbook(config("hydrate-no-attr"), mount);
    delete mount.dataset.workbook; // simulates a page editor stripping the attribute
    document.body.appendChild(mount);

    const result = await hydrateWorkbook(mount);
    expect(result).not.toBeNull();
    expect(mount.querySelector("#wb-download-pdf-btn")).not.toBeNull();
  });

  it("clicking a worksheet tab actually switches panels (regression: static HTML serialization drops JS event listeners, so a pasted multi-worksheet workbook's tabs did nothing)", async () => {
    const multiConfig = {
      id: "hydrate-tabs",
      worksheets: [
        { id: "ws1", title: "First", sections: [{ id: "s1", fields: [{ id: "a", type: "short-text", label: "A", column: 0 }] }] },
        { id: "ws2", title: "Second", sections: [{ id: "s2", fields: [{ id: "b", type: "short-text", label: "B", column: 0 }] }] },
      ],
    };
    const mount = document.createElement("div");
    mount.dataset.workbook = "hydrate-tabs";
    renderWorkbook(multiConfig, mount);
    document.body.appendChild(mount);
    await hydrateWorkbook(mount);

    const panels = mount.querySelectorAll(".wb-worksheet-panel");
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);

    mount.querySelectorAll(".wb-tab")[1].click();

    expect(panels[0].hidden).toBe(true);
    expect(panels[1].hidden).toBe(false);
  });

  it("a checklist's lock/progress/reset logic survives a real static-HTML round trip (regression: checklist.js's own render() attaches its change listener directly — unlike the tabs above, that listener is lost the same way once the markup is serialized and reparsed as plain HTML, and hydrate.js didn't re-wire it)", async () => {
    const config = {
      id: "hydrate-checklist",
      worksheets: [
        {
          id: "ws1",
          sections: [
            {
              id: "s1",
              fields: [
                {
                  id: "steps",
                  type: "checklist",
                  label: "Steps",
                  options: ["Item 1", "Item 2", "Item 3", "Item 4"],
                  dependsOn: [null, null, null, 0],
                  column: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    // Render once, then serialize to a plain HTML string and reparse it into
    // a fresh, detached container — the only way to actually test "no JS
    // closures survive", since directly reusing the rendered node would
    // still carry render()'s own listener and mask this exact bug.
    const original = document.createElement("div");
    original.dataset.workbook = "hydrate-checklist";
    renderWorkbook(config, original);
    const container = document.createElement("div");
    container.innerHTML = original.outerHTML;
    const mount = container.firstElementChild;
    document.body.appendChild(mount);

    await hydrateWorkbook(mount);

    const boxes = mount.querySelectorAll(".wb-checklist-item input");
    expect(boxes[3].disabled).toBe(true);

    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(boxes[3].disabled).toBe(false);
    expect(mount.querySelector(".wb-checklist-progress").textContent).toBe("1 of 4 done");

    mount.querySelector(".wb-checklist-reset").click();
    expect([...boxes].every((box) => !box.checked)).toBe(true);
    expect(boxes[3].disabled).toBe(true);
    expect(mount.querySelector(".wb-checklist-progress").textContent).toBe("0 of 4 done");
  });

  it("a typed value actually reaches the exported PDF (regression: worksheet id mismatch made every field blank)", async () => {
    const id = "hydrate-pdf-values";
    const mount = mountStatic(id);
    const adapter = await hydrateWorkbook(mount);

    const input = mount.querySelector("#name");
    input.value = "Ada Lovelace";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const bytes = await adapter.exportPDF();
    const pdfDoc = await PDFDocument.load(bytes);
    const field = pdfDoc.getForm().getTextField("name");
    expect(field.getText()).toBe("Ada Lovelace");
  });

  it("migrates a value saved under a stale worksheet key into the correct one, so it isn't silently dropped from PDF export (regression: value visible in the form but absent from the download)", async () => {
    const id = "hydrate-legacy-key";
    // Simulate data saved by an older version of this file, before
    // worksheet ids were tracked correctly — stored flat under "default".
    await createWorkbookStorage(id).set("state", { worksheets: { default: { name: "Old Value" } } });

    const mount = mountStatic(id);
    const adapter = await hydrateWorkbook(mount);

    // It shows up in the form (valueFor() already scanned every key)...
    expect(mount.querySelector("#name").value).toBe("Old Value");

    // ...and, after migration, it's also findable under the real worksheet
    // id, so exportWorkbookPdf() (which only looks there) doesn't miss it.
    const bytes = await adapter.exportPDF();
    const pdfDoc = await PDFDocument.load(bytes);
    expect(pdfDoc.getForm().getTextField("name").getText()).toBe("Old Value");

    await vi.waitFor(async () => {
      const saved = await createWorkbookStorage(id).get("state");
      expect(saved.worksheets["worksheet-0"].name).toBe("Old Value");
    });
  });

  it("hydrateAllWorkbooks doesn't let a malformed workbook block the others on the page", async () => {
    const broken = document.createElement("div");
    broken.className = "lms-workbook";
    broken.dataset.workbook = "broken";
    document.body.appendChild(broken);

    const good = mountStatic("hydrate-good");

    const results = await hydrateAllWorkbooks(document);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(good.querySelector("#wb-download-pdf-btn")).not.toBeNull();
  });
});
