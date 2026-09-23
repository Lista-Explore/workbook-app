import { test, expect } from "@playwright/test";

test("the preview opens as a popup, not a permanent sidebar, and stays live", async ({ page }) => {
  await page.goto("/builder/index.html");

  const dialog = page.locator("#builder-preview-dialog");
  await expect(dialog).toBeHidden();

  // Setting the title is what gives the workbook an id (auto-derived,
  // like every other id in the Builder) — that's what makes the preview
  // mountable at all. It renders even while the dialog is closed, so it's
  // ready the instant the designer opens it.
  await page.fill("#builder-workbook-title", "My Live Title");
  await expect(page.locator("#builder-preview-panel .lms-workbook")).toBeAttached();

  await page.click("#builder-preview-btn");
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.width).toBeGreaterThan(900);
  await expect(page.locator("#builder-preview-panel .wb-title")).toHaveText("My Live Title");

  // It's a real modal — the builder behind it isn't interactive until closed.
  await page.click("#builder-preview-close-btn");
  await expect(dialog).toBeHidden();

  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-section-title-input").fill("Live Section");

  await page.click("#builder-preview-btn");
  await expect(page.locator("#builder-preview-panel .wb-section-title")).toHaveText("Live Section");
  await page.click("#builder-preview-close-btn");

  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  await page.click("#builder-preview-btn");
  await expect(page.locator("#builder-preview-panel .wb-field-label")).toContainText("Your name");

  // The preview is a real, interactive Runtime render.
  await page.fill("#builder-preview-panel input[type=text]", "typed in preview");
  await expect(page.locator("#builder-preview-panel input[type=text]")).toHaveValue("typed in preview");

  // Closing it doesn't lose anything — reopening shows the same live state.
  await page.click("#builder-preview-close-btn");
  await expect(dialog).toBeHidden();
  await page.click("#builder-preview-btn");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#builder-preview-panel .wb-field-label")).toContainText("Your name");
});
