import { test, expect } from "@playwright/test";

test("the Workbook HTML is real, well-formatted form markup — no JSON, no data payload", async ({ page }) => {
  await page.goto("/builder/index.html");

  // The one-time setup is a single line pointing at the self-refreshing
  // loader — it injects the real CSS + bundled runtime itself, so nothing
  // else needs to be on the page.
  const setup = await page.locator("#builder-setup-snippet").inputValue();
  expect(setup).toContain("https://cdn.jsdelivr.net/gh/Lista-Explore/workbook-app@main/src/auto-mount.js");
  expect(setup).not.toContain("<link");

  await page.fill("#builder-workbook-title", "Publish Test Workbook");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  const htmlLocator = page.locator("#builder-workbook-html");
  await expect.poll(() => htmlLocator.inputValue()).toContain("Your name"); // wait out the async refresh
  const html = await htmlLocator.inputValue();

  expect(html).toContain('<label class="wb-field-label" for="');
  expect(html).toContain("Your name");
  expect(html).toContain('<input type="text"');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("application/json");
  expect(html).not.toContain("data-workbook-config");

  // Well-formatted: indented, not a single unbroken line.
  const lines = html.split("\n");
  expect(lines.length).toBeGreaterThan(5);
  expect(lines.some((line) => line.startsWith("  "))).toBe(true);
});

test("the Workbook HTML box asks for a title before it can generate an id", async ({ page }) => {
  await page.goto("/builder/index.html");
  await expect(page.locator("#builder-workbook-html")).toHaveValue("");
});
