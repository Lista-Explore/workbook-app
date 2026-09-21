import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

// A real, minimal 1x1 PNG — same fixture used in the unit PDF-export tests.
const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("uploading an image embeds its actual bytes in the page and the PDF, bypassing any cross-origin restriction on external image hosts", async ({
  page,
}) => {
  const pngPath = path.join(os.tmpdir(), `upload-test-${Date.now()}.png`);
  await fs.writeFile(pngPath, Buffer.from(ONE_PX_PNG_BASE64, "base64"));

  try {
    await page.goto("/builder/index.html");
    await page.fill("#builder-workbook-title", "Image Upload Test");
    await page.click("#builder-add-worksheet-btn");
    await page.click(".builder-add-section-btn");
    const sectionCard = page.locator(".builder-section-card").first();

    await sectionCard.locator(".builder-add-field-type-select").selectOption("image");
    await sectionCard.locator(".builder-add-field-btn").click();

    const imageField = sectionCard.locator(".builder-field-row").first();
    await imageField.locator('input[type="file"]').setInputFiles(pngPath);

    // The Workbook HTML now contains the image as real, inline data — not
    // a reference to any external URL.
    const htmlLocator = page.locator("#builder-workbook-html");
    await expect.poll(() => htmlLocator.inputValue()).toContain("data:image/png;base64,");
    const html = await htmlLocator.inputValue();
    expect(html).not.toContain("cdn.vectorstock.com");

    // And it actually embeds into the exported PDF as a real image, not a
    // "[image]" text placeholder — which is what happened before, since a
    // data URI never needs a cross-origin fetch to read its bytes.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#builder-download-pdf-btn"),
    ]);
    const pdfPath = await download.path();
    const bytes = await fs.readFile(pdfPath!);
    const pdfDoc = await PDFDocument.load(bytes);
    const xObjects = pdfDoc
      .getPages()[0]
      .node.Resources()
      .lookup(pdfDoc.context.obj("XObject"));
    expect(xObjects).toBeDefined();
    expect(xObjects.entries().length).toBeGreaterThan(0);
  } finally {
    await fs.unlink(pngPath).catch(() => {});
  }
});
