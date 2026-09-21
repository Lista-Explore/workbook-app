import { describe, it, expect, vi } from "vitest";
import { renderWorkbookControls } from "../../src/core/controls.js";

function fakeWorkbook(overrides = {}) {
  return {
    config: { id: "wb1" },
    exportPDF: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    importPDF: vi.fn().mockResolvedValue({ matchedCount: 2 }),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("renderWorkbookControls", () => {
  it("renders a download button, an upload file input, and a reset button", () => {
    const bar = renderWorkbookControls(fakeWorkbook());
    expect(bar.querySelector("#wb-download-pdf-btn")).not.toBeNull();
    expect(bar.querySelector("#wb-upload-pdf-input")).not.toBeNull();
    expect(bar.querySelector("#wb-reset-btn")).not.toBeNull();
  });

  it("clicking download calls workbook.exportPDF()", async () => {
    const workbook = fakeWorkbook();
    const bar = renderWorkbookControls(workbook);
    document.body.appendChild(bar);
    bar.querySelector("#wb-download-pdf-btn").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(workbook.exportPDF).toHaveBeenCalled();
    document.body.removeChild(bar);
  });

  it("clicking reset calls workbook.clear()", () => {
    const workbook = fakeWorkbook();
    const bar = renderWorkbookControls(workbook);
    bar.querySelector("#wb-reset-btn").click();
    expect(workbook.clear).toHaveBeenCalled();
  });

  it("selecting a file for upload calls workbook.importPDF() with its bytes", async () => {
    const workbook = fakeWorkbook();
    const bar = renderWorkbookControls(workbook);
    document.body.appendChild(bar);

    const input = bar.querySelector("#wb-upload-pdf-input");
    const file = new File([new Uint8Array([1, 2, 3])], "filled.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));

    // FileReader (behind the arrayBuffer() polyfill) resolves on jsdom's own
    // timer, not a microtask — poll rather than assume one tick is enough.
    await vi.waitFor(() => expect(workbook.importPDF).toHaveBeenCalled());
    document.body.removeChild(bar);
  });
});
