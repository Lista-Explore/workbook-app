import { test, expect } from "@playwright/test";

test("answers survive a page reload via IndexedDB", async ({ page }) => {
  await page.goto("/examples/index.html");
  await page.fill("#customer_name", "Persisted Co");

  // wait past the debounce window for autosave
  await page.waitForTimeout(700);

  await page.reload();
  await expect(page.locator("#customer_name")).toHaveValue("Persisted Co");
});

test("reset clears saved answers", async ({ page }) => {
  await page.goto("/examples/index.html");
  await page.fill("#customer_name", "To Be Cleared");
  await page.waitForTimeout(700);

  await page.click("#wb-reset-btn");
  await expect(page.locator("#customer_name")).toHaveValue("");

  await page.reload();
  await expect(page.locator("#customer_name")).toHaveValue("");
});
