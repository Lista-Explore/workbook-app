import { test, expect } from "@playwright/test";

test("a workbook definition file can be imported to reuse/edit it", async ({ page }) => {
  await page.goto("/builder/index.html");

  // A workbook definition someone hands you — same shape the Builder
  // itself works with, sourced independently of any Builder UI here.
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const definition = {
    id: "reusable-workbook",
    title: "Reusable Workbook",
    worksheets: [
      {
        id: "ws1",
        title: "Worksheet 1",
        sections: [
          {
            id: "s1",
            title: "Section 1",
            columns: 1,
            fields: [{ id: "q1", type: "short-text", label: "Original question", column: 0 }],
          },
        ],
      },
    ],
  };
  const jsonPath = path.join(os.tmpdir(), `reusable-workbook-${Date.now()}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(definition));

  // Start fresh, as if this were a brand-new session.
  const clearBtn = page.locator("#builder-clear-all-btn");
  await clearBtn.click();
  await clearBtn.click();
  await expect(page.locator("#builder-workbook-title")).toHaveValue("");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(0);

  // Import the previously downloaded definition.
  await page.setInputFiles("#builder-import-input", jsonPath!);
  await expect(page.locator("#builder-status-text")).toContainText("Imported");
  await expect(page.locator("#builder-workbook-title")).toHaveValue("Reusable Workbook");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(1);
  await expect(page.locator(".builder-field-label-input").first()).toHaveValue("Original question");

  // It's actually editable now, not just displayed — the whole point of
  // "reuse, edit" — and the edit survives a reload (re-saved as the draft).
  await page.locator(".builder-field-label-input").first().fill("Edited after import");
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator(".builder-field-label-input").first()).toHaveValue("Edited after import");
});

test("importing a non-workbook JSON file fails gracefully without wiping the current draft", async ({ page }) => {
  await page.goto("/builder/index.html");
  await page.fill("#builder-workbook-title", "Keep Me");

  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const badPath = path.join(os.tmpdir(), `not-a-workbook-${Date.now()}.json`);
  await fs.writeFile(badPath, JSON.stringify({ hello: "world" }));

  await page.setInputFiles("#builder-import-input", badPath);
  await expect(page.locator("#builder-status-text")).toContainText("isn't a workbook definition");
  await expect(page.locator("#builder-workbook-title")).toHaveValue("Keep Me");
});
