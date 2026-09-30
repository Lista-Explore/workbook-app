import { test, expect } from "@playwright/test";

async function mountCollapsibleFixture(page) {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <base href="http://localhost:4173/">
        <link rel="stylesheet" href="/src/styles.css">
      </head>
      <body>
        <div class="lms-workbook">
          <details class="wb-section" open>
            <summary class="wb-section-title content-summary"><div>Step 1</div></summary>
            <div class="wb-section-fields" data-columns="1">
              <div class="wb-column">
                <div class="wb-field" data-field-id="first" data-field-type="short-text">
                  <label class="wb-field-label" for="first">First</label>
                  <input id="first" type="text">
                </div>
              </div>
            </div>
          </details>
          <details class="wb-section" open>
            <summary class="wb-section-title content-summary"><div>Step 2</div></summary>
            <div class="wb-section-fields" data-columns="1">
              <div class="wb-column">
                <div class="wb-field" data-field-id="second" data-field-type="short-text">
                  <label class="wb-field-label" for="second">Second</label>
                  <input id="second" type="text">
                </div>
              </div>
            </div>
          </details>
        </div>
      </body>
    </html>
  `);
}

test("a collapsible section can be toggled open and closed", async ({ page }) => {
  await mountCollapsibleFixture(page);

  const section = page.locator("details.wb-section").first();
  await expect(section).toHaveJSProperty("open", true);

  await section.locator("summary").click();
  await expect(section).toHaveJSProperty("open", false);

  await section.locator("summary").click();
  await expect(section).toHaveJSProperty("open", true);
});

test("collapsed sections do not reserve body spacing between headers", async ({ page }) => {
  await mountCollapsibleFixture(page);

  const sections = page.locator("details.wb-section");
  expect(await sections.count()).toBeGreaterThan(1);

  await sections.evaluateAll((nodes) => {
    nodes.forEach((node) => node.removeAttribute("open"));
  });

  const first = sections.first();
  const metrics = await first.evaluate((node) => {
    const styles = getComputedStyle(node);
    const summary = node.querySelector("summary");
    const summaryStyles = summary ? getComputedStyle(summary) : null;
    return {
      marginBottom: styles.marginBottom,
      paddingTop: styles.paddingTop,
      paddingBottom: styles.paddingBottom,
      summaryMarginBottom: summaryStyles?.marginBottom,
    };
  });
  const gap = await sections.evaluateAll((nodes) => {
    const firstSummary = nodes[0].querySelector("summary").getBoundingClientRect();
    const secondSummary = nodes[1].querySelector("summary").getBoundingClientRect();
    return secondSummary.top - firstSummary.bottom;
  });

  expect(metrics).toEqual({
    marginBottom: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    summaryMarginBottom: "0px",
  });
  expect(gap).toBe(0);
});

test("open and collapsed section headers keep the same width and left edge", async ({ page }) => {
  await mountCollapsibleFixture(page);

  const sections = page.locator("details.wb-section");
  await sections.first().evaluate((node) => node.removeAttribute("open"));

  const headerMetrics = await sections.evaluateAll((nodes) =>
    nodes.slice(0, 2).map((node) => {
      const box = node.querySelector("summary").getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    })
  );

  expect(headerMetrics[0].left).toBe(headerMetrics[1].left);
  expect(headerMetrics[0].right).toBe(headerMetrics[1].right);
  expect(headerMetrics[0].width).toBe(headerMetrics[1].width);
});
