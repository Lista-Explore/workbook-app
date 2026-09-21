import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("downloaded PDF has real, fillable AcroForm fields (not flattened, not drawn boxes)", async ({ page }) => {
  await page.goto("/examples/index.html");
  await page.fill("#customer_name", "Acme Ltd");
  await page.fill("#customer_description", "A long-time enterprise customer.");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#wb-download-pdf-btn"),
  ]);

  const filePath = await download.path();
  const bytes = await (await import("node:fs/promises")).readFile(filePath!);
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const fieldNames = fields.map((f) => f.getName());
  expect(fieldNames).toContain("customer_name");
  expect(fieldNames).toContain("customer_description");

  const nameField = form.getTextField("customer_name");
  expect(nameField.getText()).toBe("Acme Ltd");

  const descriptionField = form.getTextField("customer_description");
  expect(descriptionField.isMultiline()).toBe(true);
  expect(descriptionField.getText()).toBe("A long-time enterprise customer.");

  // Fillable by default: nothing should be read-only/flattened.
  for (const field of fields) {
    expect(field.isReadOnly()).toBe(false);
  }
});
