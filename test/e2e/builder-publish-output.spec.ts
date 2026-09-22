import { test, expect } from "@playwright/test";

test("the Workbook HTML is real, well-formatted form markup — no JSON, no data payload", async ({ page }) => {
  await page.goto("/builder/index.html");

  // The one-time setup is two separate script tags — one for the
  // stylesheet, one for the runtime bundle. Each resolves the latest
  // commit itself at page-load time, so neither one can ever go stale on
  // an already-pasted page, and there's no separate CSS pin to forget to
  // bump.
  const setup = await page.locator("#builder-setup-snippet").inputValue();
  // Commit-pinned, not "@main" — a branch URL can serve a stale commit on
  // jsDelivr for a long time after a push, even with a cache-busting query.
  expect(setup).toMatch(
    /https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@[0-9a-f]{40}\/src\/auto-mount\.js/
  );
  expect(setup).toMatch(
    /https:\/\/cdn\.jsdelivr\.net\/gh\/Lista-Explore\/workbook-app@[0-9a-f]{40}\/src\/auto-mount-styles\.js/
  );

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
