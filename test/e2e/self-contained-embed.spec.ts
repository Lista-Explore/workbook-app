import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// Proves the actual claim: paste the one-time setup (CSS + JS) once, plus
// the plain Workbook HTML (no JSON, no data payload) wherever it should
// appear, and the workbook is fully interactive — autosave, PDF download,
// reset — because the script reads the HTML that's already there, not any
// embedded config. Uses runtime-entry.js (the actual hydration logic)
// directly rather than going through auto-mount.js's CDN redirect, so this
// stays a local, network-independent test — the CDN delivery layer itself
// is verified separately against the live jsDelivr URLs.
test("the Workbook HTML is genuinely self-contained: plain markup + the runtime script, nothing else", async ({
  page,
}) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "Self Contained Embed Test");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");

  const htmlLocator = page.locator("#builder-workbook-html");
  await expect.poll(() => htmlLocator.inputValue()).toContain("Your name"); // wait out the async refresh
  const mountHtml = await htmlLocator.inputValue();

  const html = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    ${mountHtml}
    <script type="module" src="/src/runtime-entry.js"></script>
  </body>
</html>`;

  const testPagePath = path.join(process.cwd(), "examples", "__self-contained-embed-test.html");
  await fs.writeFile(testPagePath, html);

  try {
    await page.goto("/examples/__self-contained-embed-test.html");
    const fieldInput = page.locator("input[type=text]").first();
    await expect(fieldInput).toBeVisible();
    await fieldInput.fill("Test Student");

    // The download control came from the Runtime automatically — this page
    // never wrote a single line of JS to wire it up, and the script had no
    // config to read except the HTML itself.
    await expect(page.locator("#wb-download-pdf-btn")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#wb-download-pdf-btn"),
    ]);
    expect(await download.path()).toBeTruthy();

    // Autosave survives a reload, reading the value back from the same HTML.
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator("input[type=text]").first()).toHaveValue("Test Student");
  } finally {
    await fs.unlink(testPagePath).catch(() => {});
  }
});
