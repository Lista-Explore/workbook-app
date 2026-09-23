import { test, expect } from "@playwright/test";

test("standalone questions retain ordering, answers and drafts alongside sections", async ({ page }) => {
  await page.goto("/builder/");
  await page.locator("#builder-workbook-title").fill("Standalone workflow");
  await page.getByRole("button", { name: "Add worksheet", exact: true }).click();
  const editor = page.locator("#builder-section-editor");
  const outside = editor.locator(":scope > .builder-standalone-block .builder-fields-container");
  await expect(editor.locator(".builder-section-card")).toHaveCount(0);
  for (const label of ["First question", "Second question"]) {
    await outside.last().getByRole("button", { name: "+ Add question", exact: true }).click();
    await outside.last().locator(".builder-field-label-input").last().fill(label);
  }
  await outside.first().getByRole("button", { name: "Move question up" }).nth(1).click();
  await expect(outside.first().locator(".builder-field-label-input").first()).toHaveValue("Second question");
  await editor.getByRole("button", { name: "+ Add section", exact: true }).click();
  const section = editor.locator(".builder-section-card");
  await section.locator(".builder-section-title-input").fill("Optional section");
  await section.getByRole("button", { name: "+ Add question", exact: true }).click();
  await section.locator(".builder-field-label-input").fill("Inside section");
  await outside.last().getByRole("button", { name: "+ Add question", exact: true }).click();
  await outside.last().locator(".builder-field-label-input").fill("After section");
  await expect.poll(() => page.locator("#builder-workbook-html").inputValue()).toContain("After section");
  await page.locator("#builder-preview-btn").click();
  const preview = page.locator("#builder-preview-panel");
  await expect(preview.locator(".wb-field-label")).toHaveText(["Second question", "First question", "Inside section", "After section"]);
  await expect(preview.locator("details")).toHaveCount(1);
  await preview.getByLabel("First question", { exact: true }).fill("Saved standalone answer");
  await page.locator("#builder-preview-close-btn").click();
  // Wait for the app's actual IndexedDB writes, not a fixed delay.
  await expect.poll(() => page.evaluate(async () => {
    const { createPreviewStorage } = await import("/src/core/storage.js");
    return JSON.stringify(await createPreviewStorage("standalone-workflow").get("state"));
  })).toContain("Saved standalone answer");
  await page.reload();
  await expect(editor.locator(".builder-field-label-input")).toHaveCount(4);
  await page.locator("#builder-preview-btn").click();
  await expect(preview.getByLabel("First question", { exact: true })).toHaveValue("Saved standalone answer");
  await page.locator("#builder-preview-close-btn").click();
  await section.getByRole("button", { name: "Remove section", exact: true }).click();
  await expect(editor.locator(".builder-field-label-input")).toHaveCount(3);
  await expect(editor.locator(".builder-section-card")).toHaveCount(0);
  // Removing all questions must not publish empty section-shaped blocks.
  while (await editor.getByRole("button", { name: "Remove question", exact: true }).count()) {
    await editor.getByRole("button", { name: "Remove question", exact: true }).first().click();
  }
  await expect.poll(() => page.locator("#builder-workbook-html").inputValue()).not.toContain('data-unsectioned');
  await expect(outside.getByRole("button", { name: "+ Add question", exact: true })).toHaveCount(1);
});
