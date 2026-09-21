import { test, expect } from "@playwright/test";

test("an image field renders with alt text and caption, positioned among the other questions", async ({ page }) => {
  await page.goto("/examples/index.html");

  const figure = page.locator("figure.wb-field-image");
  await expect(figure).toHaveCount(1);
  await expect(figure.locator("img")).toHaveAttribute("alt", "Illustration of customer needs");
  await expect(figure.locator("figcaption")).toHaveText("Think broadly about what this customer values.");

  // it's just another field in the section's flow, not a separate slot
  await expect(page.locator(".wb-section-fields [data-field-type='image']")).toHaveCount(1);
});
