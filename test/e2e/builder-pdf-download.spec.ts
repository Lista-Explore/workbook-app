import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("Download fillable PDF from the Builder produces real AcroForm fields", async ({ page }) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "Builder PDF Download Test");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  // The PDF button is not gated behind Publish — a designer should be able
  // to grab a fillable PDF without first publishing the workbook.
  await expect(page.locator("#builder-download-pdf-btn")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#builder-download-pdf-btn"),
  ]);

  const path = await download.path();
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(path!);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const fieldNames = form.getFields().map((f) => f.getName());

  // The field's id was generated from its default label ("New question")
  // when it was created, and stays fixed even though the label was edited
  // afterward — same stability rule as every other id in the Builder.
  expect(fieldNames).toContain("new-question");
  expect(form.getTextField("new-question").isReadOnly()).toBe(false);
});
