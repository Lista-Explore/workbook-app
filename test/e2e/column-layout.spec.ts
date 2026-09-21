import { test, expect } from "@playwright/test";

test("a section renders with its configured column count", async ({ page }) => {
  await page.goto("/examples/index.html");

  const twoColumnFields = page.locator('.wb-section-fields[data-columns="2"]');
  await expect(twoColumnFields).toHaveCount(1);

  const oneColumnFields = page.locator('.wb-section-fields[data-columns="1"]');
  await expect(oneColumnFields.first()).toBeVisible();
});
