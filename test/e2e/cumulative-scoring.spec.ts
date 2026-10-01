import { test, expect } from "@playwright/test";

test("a designer builds a scored assessment: rating scales, a score summary and a personalised prompt", async ({ page }) => {
  await page.goto("/builder/index.html?draftKey=cumulative-scoring-e2e");
  await page.locator("#builder-workbook-title").fill("Scored assessment");
  await page.getByRole("button", { name: "Add worksheet", exact: true }).click();
  await page.getByRole("button", { name: "+ Add section", exact: true }).click();
  const section = page.locator(".builder-section-card").first();
  const addQuestion = async (type: string) => {
    await section.locator(".builder-add-field-type-select").last().selectOption(type);
    await section.locator(".builder-add-field-btn").last().click();
  };

  // Two rating scales
  for (const [index, name] of ["Communication", "Adaptability"].entries()) {
    await addQuestion("scale");
    const row = section.locator(".builder-field-row").nth(index);
    await row.locator(".builder-field-label-input").fill(`${name} Confidence`);
    await row.locator(".builder-scoring-grid input").nth(0).fill(name);
    await row.locator(".builder-scoring-grid input").nth(1).fill(`${name} Confidence Score`);
    await row.locator(".builder-scale-bulk").fill(`1. I speak up in meetings\n2. I give feedback\n3. I present to leaders`);
    await row.getByRole("button", { name: "Add pasted statements" }).click();
  }
  const first = section.locator(".builder-field-row").nth(0);
  // pasting replaces the blank starter statements
  await expect(first.locator(".builder-scale-statement-input")).toHaveCount(3);
  await expect(first.locator(".builder-scale-statement-input").first()).toHaveValue("I speak up in meetings");

  // Bands on the first scale, copied to the second
  await first.getByRole("button", { name: "+ Add result band" }).click();
  await first.getByRole("button", { name: "+ Add result band" }).click();
  const bandRows = first.locator(".builder-band-row");
  await bandRows.nth(0).locator("input").nth(0).fill("12");
  await bandRows.nth(0).locator("input").nth(1).fill("15");
  await bandRows.nth(0).locator(".builder-band-label").fill("Strength");
  await bandRows.nth(1).locator("input").nth(0).fill("3");
  await bandRows.nth(1).locator("input").nth(1).fill("11");
  await bandRows.nth(1).locator(".builder-band-label").fill("Growth edge");

  // Score summary picks up both scales automatically
  await addQuestion("scoreboard");
  const board = section.locator(".builder-field-row").nth(2);
  await expect(board.locator(".builder-scoreboard-row")).toHaveCount(2);
  await board.getByLabel("Show a “what the scores mean” key").check();

  // Personalised text
  await addQuestion("scored-text");
  const text = section.locator(".builder-field-row").nth(3);
  await text.locator(".builder-scored-text-template").fill("Total: ");
  await text.locator(".builder-scored-text-insert").selectOption({ index: 1 });
  await text.locator(".builder-scored-text-template").press("End");

  await expect(page.locator("#builder-workbook-html")).toHaveValue(/data-field-type="scale"/);
  await expect(page.locator("#builder-workbook-html")).toHaveValue(/data-field-type="scoreboard"/);
  await expect(page.locator("#builder-workbook-html")).toHaveValue(/data-field-type="scored-text"/);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.locator("#builder-preview-panel");
  const scale = preview.locator('[data-field-type="scale"]').first();
  await expect(scale.locator(".wb-score-max")).toHaveText(" / 15");
  await expect(scale.locator(".wb-score-progress")).toContainText("0 of 3");

  // Rating fills the running score, band, and the summary table
  for (let i = 0; i < 3; i++) await scale.locator(".wb-scale-row").nth(i).locator('input[value="4"]').check();
  await expect(scale.locator(".wb-score-value")).toHaveText("12");
  await expect(scale.locator(".wb-score-band-label")).toHaveText("Strength");
  const summary = preview.locator('[data-field-type="scoreboard"]');
  await expect(summary.locator(".wb-scoreboard-total-score")).toHaveText("12");
  await expect(summary.locator(".wb-scoreboard-note")).toContainText("1 of 2 areas complete");

  const second = preview.locator('[data-field-type="scale"]').nth(1);
  for (let i = 0; i < 3; i++) await second.locator(".wb-scale-row").nth(i).locator('input[value="2"]').check();
  await expect(summary.locator(".wb-scoreboard-total-score")).toHaveText("18");
  await expect(summary.locator(".wb-is-strongest")).toContainText("Communication");
  await expect(summary.locator(".wb-is-lowest")).toContainText("Adaptability");
  await expect(summary.locator(".wb-band-key")).toBeVisible();
  await expect(preview.locator(".wb-scored-text-body")).toContainText("Total: ");

  // Ratings persist across a reload of the preview
  await page.locator("#builder-preview-close-btn").click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview.locator('[data-field-type="scale"]').first().locator(".wb-score-value")).toHaveText("12");
});
