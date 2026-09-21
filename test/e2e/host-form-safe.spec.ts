import { test, expect } from "@playwright/test";

// A real bug this guards against: the widget can land inside a host page's
// own <form> (an LMS page editor is exactly this). A native `required` on
// our inputs would block THAT form's submit — not just ours — even if the
// student never touches our widget. Required must be enforced only via our
// own validation (validate() + wb-field-error), never the native attribute.
test("a required field never sets the native HTML required attribute, so a host page's own form can submit past it", async ({
  page,
}) => {
  await page.goto("/builder/index.html");

  await page.fill("#builder-workbook-title", "Host Form Safety Test");
  await page.click("#builder-add-worksheet-btn");
  await page.click(".builder-add-section-btn");
  const sectionCard = page.locator(".builder-section-card").first();
  await sectionCard.locator(".builder-add-field-btn").click();
  const fieldRow = sectionCard.locator(".builder-field-row").first();
  await fieldRow.locator(".builder-field-label-input").fill("Your name");
  await fieldRow.locator("input[type=checkbox]").first().check(); // "Required" toggle

  const htmlLocator = page.locator("#builder-workbook-html");
  await expect.poll(() => htmlLocator.inputValue()).toContain("Your name");
  const mountHtml = await htmlLocator.inputValue();
  expect(mountHtml).not.toContain(" required");

  // Simulate the real failure mode: our widget embedded inside a host
  // page's own <form>, which has its own required field for the host page
  // (e.g. a page title) that IS legitimately empty. If our field carried a
  // native `required`, the browser would refuse to submit this host form —
  // even though the empty field belongs to the host, not to us.
  const testPagePath = "examples/__host-form-safe-test.html";
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const fullPath = path.join(process.cwd(), testPagePath);
  await fs.writeFile(
    fullPath,
    `<!doctype html>
<html>
<body>
<form id="host-form" action="#" onsubmit="window.__submitted = true; return false;">
  ${mountHtml}
  <button type="submit" id="host-submit-btn">Save host page</button>
</form>
</body>
</html>`
  );

  try {
    await page.goto("/examples/__host-form-safe-test.html");
    // Our required field is left blank on purpose — this must not block
    // the host form's own submit.
    await page.click("#host-submit-btn");
    await expect.poll(() => page.evaluate(() => window.__submitted)).toBe(true);
  } finally {
    await fs.unlink(fullPath).catch(() => {});
  }
});
