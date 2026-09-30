import { describe, it, expect, vi } from "vitest";
import { renderTextEditor } from "../../builder/src/ui/text-editor.js";

describe("builder text editor", () => {
  it("renders checklist option text as a compact editor, not a nested workbook field", () => {
    const editor = renderTextEditor(
      { text: "Plan", textHtml: "<h2>Plan</h2><p>Review</p>" },
      "text",
      "builder-checklist-item-input",
      "Item 1",
      vi.fn()
    );

    expect(editor.classList.contains("builder-text-editor")).toBe(true);
    expect(editor.classList.contains("wb-field")).toBe(false);
    expect(editor.querySelector(":scope > .wb-field-label")).toBe(null);
    expect(editor.querySelector(":scope > .wb-field-error")).toBe(null);
    expect(editor.querySelector(":scope > .wb-rich-text-toolbar")).not.toBe(null);
    expect(editor.querySelector(":scope > .wb-rich-text-input")).not.toBe(null);
    expect(editor.querySelector(".builder-checklist-item-input h2").textContent).toBe("Plan");
  });
});
