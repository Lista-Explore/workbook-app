import { test, expect } from "@playwright/test";

test("the Workbook HTML box contains the actual, well-formatted rendered form — no publish step, no JSON", async ({
  page,
}) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "Publish Test Workbook");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  // The HTML box is the real, rendered form markup, updated live — not
  // JSON, not a path to a file, and not gated behind any button.
  const htmlLocator = page.locator("#builder-workbook-html");
  await expect.poll(() => htmlLocator.inputValue()).toContain("Your name"); // wait out the async refresh
  const html = await htmlLocator.inputValue();
  expect(html).toContain('<label class="wb-field-label" for="');
  expect(html).toContain("Your name");
  expect(html).toContain('<input type="text"');
  expect(html).not.toContain("data-workbook-config");

  // Well-formatted: indented, not a single unbroken line.
  const lines = html.split("\n");
  expect(lines.length).toBeGreaterThan(5);
  expect(lines.some((line) => line.startsWith("  "))).toBe(true);
});
