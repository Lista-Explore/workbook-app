import { test, expect } from "@playwright/test";

test("a collapsible section can be toggled open and closed", async ({ page }) => {
  await page.goto("/examples/index.html");

  const section = page.locator("details.wb-section");
  await expect(section).toHaveJSProperty("open", true);

  await section.locator("summary").click();
  await expect(section).toHaveJSProperty("open", false);

  await section.locator("summary").click();
  await expect(section).toHaveJSProperty("open", true);
});
