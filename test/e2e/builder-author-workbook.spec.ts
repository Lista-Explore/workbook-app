import { test, expect } from "@playwright/test";

test("a designer can author a multi-worksheet workbook purely by clicking", async ({ page }) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "E2E Workbook");

  await page.click("#builder-add-worksheet-btn");
  await expect(page.locator(".builder-worksheet-tab")).toHaveCount(1);

  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-section-title-input").fill("Basic Information");
  await sectionCard.locator("select").first().selectOption("2"); // columns

  // With 2 columns, each column has its own type picker + "+ Add question" button.
  const firstColumn = sectionCard.locator(".builder-field-column").first();
  await firstColumn.locator(".builder-add-field-btn").click();
  const firstField = sectionCard.locator(".builder-field-row").first();
  await firstField.locator(".builder-field-label-input").fill("Customer name");

  // Add a dropdown field with two options, using that same column's picker
  await firstColumn.locator(".builder-add-field-type-select").selectOption("dropdown");
  await firstColumn.locator(".builder-add-field-btn").click();
  const dropdownField = sectionCard.locator(".builder-field-row").nth(1);
  await dropdownField.locator(".builder-field-label-input").fill("Customer type");
  const optionInputs = dropdownField.locator(".builder-option-row input");
  await optionInputs.nth(0).fill("Small business");
  await optionInputs.nth(1).fill("Enterprise");

  await expect(page.locator(".builder-field-row")).toHaveCount(2);
  await expect(dropdownField.locator(".builder-option-row")).toHaveCount(2);
});

test("a question can be reordered without deleting the ones around it", async ({ page }) => {
  await page.goto("/builder/index.html");
  await page.fill("#builder-workbook-title", "E2E Reorder Workbook");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();

  for (const label of ["First", "Second", "Third"]) {
    await sectionCard.locator(".builder-add-field-btn").click();
    await sectionCard.locator(".builder-field-row").last().locator(".builder-field-label-input").fill(label);
  }

  const values = () => sectionCard.locator(".builder-field-label-input").evaluateAll((els) => els.map((e) => e.value));

  await expect.poll(values).toEqual(["First", "Second", "Third"]);

  // Move "Second" up one slot — should not require touching First or Third.
  await sectionCard.locator(".builder-field-row").nth(1).locator('[aria-label="Move question up"]').click();
  await expect.poll(values).toEqual(["Second", "First", "Third"]);

  // The top item's "move up" is disabled; the bottom item's "move down" is disabled.
  await expect(sectionCard.locator(".builder-field-row").first().locator('[aria-label="Move question up"]')).toBeDisabled();
  await expect(sectionCard.locator(".builder-field-row").last().locator('[aria-label="Move question down"]')).toBeDisabled();
});

test("a 2-column section renders as two independent, STABLE vertical stacks, each with its own add button", async ({ page }) => {
  await page.goto("/builder/index.html");
  await page.fill("#builder-workbook-title", "E2E Columns Workbook");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator("select").first().selectOption("2"); // columns

  // Two independent columns means two add buttons, present even before
  // any questions exist — you can start filling either column first.
  await expect(sectionCard.locator(".builder-field-column")).toHaveCount(2);
  await expect(sectionCard.locator(".builder-add-field-btn")).toHaveCount(2);

  const columns = sectionCard.locator(".builder-field-column");
  const columnValues = (col) => col.locator(".builder-field-label-input").evaluateAll((els) => els.map((e) => e.value));

  // Add straight into column 1 three times, using THAT column's own button.
  for (const label of ["A1", "A2", "A3"]) {
    await columns.nth(0).locator(".builder-add-field-btn").click();
    await columns.nth(0).locator(".builder-field-row").last().locator(".builder-field-label-input").fill(label);
  }
  await expect.poll(() => columnValues(columns.nth(0))).toEqual(["A1", "A2", "A3"]);
  // Column 2 is untouched by everything that just happened in column 1.
  await expect.poll(() => columnValues(columns.nth(1))).toEqual([]);

  // Now add into column 2 — column 1 must stay exactly as it was.
  await columns.nth(1).locator(".builder-add-field-btn").click();
  await columns.nth(1).locator(".builder-field-row").last().locator(".builder-field-label-input").fill("B1");
  await expect.poll(() => columnValues(columns.nth(1))).toEqual(["B1"]);
  await expect.poll(() => columnValues(columns.nth(0))).toEqual(["A1", "A2", "A3"]);
});

test("each worksheet has its own independent sections", async ({ page }) => {
  await page.goto("/builder/index.html");
  await page.fill("#builder-workbook-title", "E2E Workbook 2");

  // A new worksheet already has one section — no "+ Add section" click needed.
  await page.click("#builder-add-worksheet-btn");
  await expect(page.locator(".builder-section-card")).toHaveCount(1);
  await page.click(".builder-add-section-btn");
  await expect(page.locator(".builder-section-card")).toHaveCount(2);

  await page.click("#builder-add-worksheet-btn");
  // The freshly added second worksheet has its own single starter section —
  // not the first worksheet's two.
  await expect(page.locator(".builder-section-card")).toHaveCount(1);

  // Switching back to the first worksheet still shows its own two sections.
  await page.locator(".builder-worksheet-tab button").first().click();
  await expect(page.locator(".builder-section-card")).toHaveCount(2);
});
