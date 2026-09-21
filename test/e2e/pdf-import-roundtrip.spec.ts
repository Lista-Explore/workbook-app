import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("download a PDF, fill it externally, upload it, and see the HTML + storage populated", async ({ page }) => {
  await page.goto("/examples/index.html");
  await page.fill("#customer_name", "Acme Ltd");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#wb-download-pdf-btn"),
  ]);
  const downloadedPath = await download.path();
  const originalBytes = await readFile(downloadedPath!);

  // Simulate a student filling in more of the PDF outside the browser.
  const pdfDoc = await PDFDocument.load(originalBytes);
  const form = pdfDoc.getForm();
  form.getDropdown("customer_type").select("Enterprise");
  form.getRadioGroup("priority").select("High");
  form.getCheckBox("needs__opt__0").check(); // Speed
  form.getCheckBox("needs__opt__3").check(); // Support
  form.getTextField("reflection").setText("Learned a lot.");
  const filledBytes = await pdfDoc.save();

  const tmpPath = path.join(os.tmpdir(), `filled-${Date.now()}.pdf`);
  await writeFile(tmpPath, filledBytes);

  await page.reload();
  // The customer_name saved from before the reload should still be there.
  await expect(page.locator("#customer_name")).toHaveValue("Acme Ltd");

  await page.setInputFiles("#wb-upload-pdf-input", tmpPath);
  await expect(page.locator("#customer_type")).toHaveValue("Enterprise");
  await expect(page.locator('input[name="priority"][value="High"]')).toBeChecked();
  await expect(page.locator('input[name="needs"][value="Speed"]')).toBeChecked();
  await expect(page.locator('input[name="needs"][value="Support"]')).toBeChecked();

  await page.click(".wb-tab >> nth=1");
  await expect(page.locator("#reflection")).toHaveValue("Learned a lot.");

  // Confirm it was persisted, not just applied to the live DOM.
  await page.reload();
  await expect(page.locator("#customer_type")).toHaveValue("Enterprise");
});
