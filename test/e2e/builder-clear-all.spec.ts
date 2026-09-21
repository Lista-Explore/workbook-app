import { test, expect } from "@playwright/test";

test("Clear all requires a second click to confirm (click-to-arm, not a native dialog)", async ({ page }) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "About To Be Cleared");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(1);
  await expect(page.locator(".builder-section-card")).toHaveCount(1);

  const clearBtn = page.locator("#builder-clear-all-btn");

  // First click only arms it — nothing is cleared yet.
  await clearBtn.click();
  await expect(clearBtn).toHaveText("Click again to confirm");
  await expect(page.locator("#builder-workbook-title")).toHaveValue("About To Be Cleared");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(1);

  // Waiting it out (not confirming) reverts it — nothing is cleared.
  await page.waitForTimeout(8200);
  await expect(clearBtn).toHaveText("Clear all");
  await expect(page.locator("#builder-workbook-title")).toHaveValue("About To Be Cleared");

  // Clicking it twice in a row actually clears everything.
  await clearBtn.click();
  await clearBtn.click();
  await expect(clearBtn).toHaveText("Clear all");
  await expect(page.locator("#builder-workbook-title")).toHaveValue("");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(0);
  await expect(page.locator(".builder-section-card")).toHaveCount(0);

  // And it stays cleared after a reload — the empty state was itself saved.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator("#builder-workbook-title")).toHaveValue("");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(0);
});
