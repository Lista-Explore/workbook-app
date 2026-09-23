import { test, expect } from "@playwright/test";

test("renders the workbook and lets a student fill fields", async ({ page }) => {
  await page.goto("/examples/index.html");

  await expect(page.locator(".wb-title")).toHaveText("Customer Analysis Workbook");

  await page.fill("#customer_name", "Acme Ltd");
  await page.selectOption("#customer_type", "Enterprise");
  await page.check('input[name="priority"][value="High"]');
  await page.check('input[name="needs"][value="Support"]');

  await expect(page.locator("#customer_name")).toHaveValue("Acme Ltd");
  await expect(page.locator("#customer_type")).toHaveValue("Enterprise");
  await expect(page.locator('input[name="priority"][value="High"]')).toBeChecked();
  await expect(page.locator('input[name="needs"][value="Support"]')).toBeChecked();

  const justifyContent = await page.locator('#wb-controls').evaluate((node) => getComputedStyle(node).justifyContent);
  expect(justifyContent).toBe('center');
});
