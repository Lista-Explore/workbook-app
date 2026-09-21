import { test, expect } from "@playwright/test";

test("every worksheet tab is clickable, including the second and beyond", async ({ page }) => {
  await page.goto("/examples/index.html");

  const tabs = page.locator(".wb-tab");
  await expect(tabs).toHaveCount(2);

  // Worksheet 1 visible by default
  await expect(page.locator('[data-workbook-panel-index="0"]')).toBeVisible();
  await expect(page.locator('[data-workbook-panel-index="1"]')).toBeHidden();

  // Click the second tab — must work, not just the first
  await tabs.nth(1).click();
  await expect(page.locator('[data-workbook-panel-index="1"]')).toBeVisible();
  await expect(page.locator('[data-workbook-panel-index="0"]')).toBeHidden();

  // And back to the first
  await tabs.nth(0).click();
  await expect(page.locator('[data-workbook-panel-index="0"]')).toBeVisible();
});
