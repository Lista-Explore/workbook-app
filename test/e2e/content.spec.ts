import { test, expect } from '@playwright/test';

test('Content formatting survives preview, structural edits, and draft reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/builder/index.html');
  await page.locator('#builder-workbook-title').fill('Content workbook');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const picker = page.locator('.builder-add-field-type-select').last();
  await expect(picker.locator('option[value="heading"]')).toHaveCount(0);
  await picker.selectOption('content');
  await page.getByRole('button', { name: '+ Add question', exact: true }).last().click();
  // SunEditor exposes contenteditable without a textbox role on some browsers.
  const body = page.locator('[contenteditable="true"][aria-label="Content text"]');
  await expect(body).toBeVisible();
  await body.fill('Formatted content');
  await body.press('ControlOrMeta+a');
  await page.locator('.sun-editor button[data-command="bold"]').click();
  await expect(body.locator('strong,b')).toHaveText('Formatted content');
  await body.press('ArrowRight');
  await page.locator('.sun-editor button[data-command="image"]').click();
  const imageDialog = page.locator('.se-dialog-image');
  await expect(imageDialog.locator('input[type="file"]')).toHaveCount(0);
  await expect(imageDialog.locator('._se_image_url')).toBeVisible();
  await imageDialog.locator('._se_image_url').fill('https://example.com/content.png');
  await imageDialog.locator('._se_image_alt').fill('Content image');
  await imageDialog.locator('.se-btn-primary').click();
  await expect(body.locator('img[alt="Content image"]')).toHaveAttribute('src', 'https://example.com/content.png');
  await expect(page.locator('#builder-workbook-html')).toHaveValue(/<img src="https:\/\/example\.com\/content\.png" alt="Content image"/);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('#builder-preview-panel .wb-content strong, #builder-preview-panel .wb-content b')).toHaveText('Formatted content');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#builder-status-text')).toHaveText('Draft saved.');
  await page.reload();
  await expect(body.locator('strong,b')).toHaveText('Formatted content');
  await page.getByRole('button', { name: '+ Add section', exact: true }).click();
  await expect(body.locator('strong,b')).toHaveText('Formatted content');
  expect(errors).toEqual([]);
});

test('published Content image alignment and sizing render in workbook HTML', async ({ page }) => {
  await page.goto('/builder/index.html');
  await page.setContent(`
    <link rel="stylesheet" href="/src/styles.css">
    <div class="wb-content" style="width: 600px; border: 0;">
      <div class="se-component se-image-container __se__float-center" style="min-width: 100%; width: 50%;">
        <figure style="width: 50%;">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='black'/%3E%3C/svg%3E" alt="Centered" style="width: 100%;" data-align="center" data-percentage="50," data-size="50%,">
        </figure>
      </div>
    </div>
  `);

  const contentBox = await page.locator('.wb-content').boundingBox();
  const imageBox = await page.locator('.wb-content img').boundingBox();
  expect(contentBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  const contentCenter = contentBox!.x + contentBox!.width / 2;
  const imageCenter = imageBox!.x + imageBox!.width / 2;
  expect(Math.abs(imageCenter - contentCenter)).toBeLessThan(2);
  expect(imageBox!.width).toBeCloseTo(300, 1);
});
