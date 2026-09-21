import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// Proves the literal claim: the "Workbook HTML" box in the Builder is real,
// complete markup — paste it alone into a bare page and the form appears,
// no JSON, no separate runtime file, no script.
test("the Workbook HTML box is real markup that renders the form on its own", async ({ page }) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "Self Contained Embed Test");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  const htmlLocator = page.locator("#builder-workbook-html");
  await expect.poll(() => htmlLocator.inputValue()).toContain("Your name"); // wait out the async refresh
  const html = await htmlLocator.inputValue();

  const testPagePath = path.join(process.cwd(), "examples", "__self-contained-embed-test.html");
  await fs.writeFile(testPagePath, `<!doctype html>\n<html>\n<body>\n${html}\n</body>\n</html>`);

  try {
    await page.goto("/examples/__self-contained-embed-test.html");
    const fieldInput = page.locator("input[type=text]").first();
    await expect(fieldInput).toBeVisible();
    await expect(page.locator("label", { hasText: "Your name" })).toBeVisible();
    await fieldInput.fill("Test Student");
    await expect(fieldInput).toHaveValue("Test Student");
  } finally {
    await fs.unlink(testPagePath).catch(() => {});
  }
});
