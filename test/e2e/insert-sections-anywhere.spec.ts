import { test, expect } from "@playwright/test";

test("sections and no-section layouts can be inserted, moved and re-columned anywhere", async ({ page }) => {
  await page.goto("/builder/index.html?draftKey=insert-anywhere-e2e");
  await page.fill("#builder-workbook-title", "Insert anywhere");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  await page.locator(".builder-section-title-input").first().fill("Last");

  // Insert a section ABOVE it, then a no-section layout between them.
  await page.locator(".builder-insert-section-btn").first().click();
  await page.locator(".builder-section-title-input").first().fill("First");
  await page.locator(".builder-insert-layout-btn").nth(1).click();
  const order = () => page.locator(".builder-section-card, .builder-standalone-block").evaluateAll((els) => els.map((e) => (e.classList.contains("builder-standalone-block") ? "layout" : e.querySelector("input").value)));
  await expect.poll(order).toEqual(["First", "layout", "Last"]);

  // Move the layout to the top, then change the FIRST layout's columns.
  await page.locator(".builder-standalone-block .builder-section-move-btn").first().click();
  await expect.poll(order).toEqual(["layout", "First", "Last"]);
  await page.locator(".builder-standalone-block .builder-columns-control select").first().selectOption("2");
  await expect(page.locator(".builder-standalone-block .builder-field-column")).toHaveCount(2);
});
