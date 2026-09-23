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

test('Content editor can expand from multi-column builder sections without changing published columns', async ({ page }) => {
  await page.goto('/builder/index.html');
  await page.locator('#builder-workbook-title').fill('Content columns');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await page.getByRole('button', { name: '+ Add section', exact: true }).click();
  const section = page.locator('.builder-section-card').first();
  await section.locator('select').first().selectOption('2');
  await section.locator('.builder-add-field-type-select').first().selectOption('content');
  await section.locator('.builder-add-field-btn').first().click();

  const fieldList = section.locator('.builder-field-list');
  await expect(fieldList).toHaveAttribute('data-columns', '2');
  await expect(section.locator('.builder-content-editor')).toBeVisible();
  await expect.poll(() => fieldList.evaluate((node) => getComputedStyle(node).display)).toBe('grid');

  const body = section.locator('[contenteditable="true"][aria-label="Content text"]');
  await expect(body).toBeVisible();
  await body.fill('Editable in columns');
  await body.press('ControlOrMeta+a');
  await section.locator('.sun-editor button[data-command="bold"]').click();
  await expect(body.locator('strong,b')).toHaveText('Editable in columns');

  await section.getByRole('button', { name: 'Expand editor' }).click();
  const dialog = page.locator('.builder-content-expand-dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.boundingBox()).toMatchObject({ width: expect.any(Number) });
  const dialogBox = await dialog.boundingBox();
  const inlineBox = await section.locator('.builder-content-editor').boundingBox();
  expect(dialogBox!.width).toBeGreaterThan(inlineBox!.width * 1.8);
  const expandedBody = dialog.locator('[contenteditable="true"][aria-label="Content text"]');
  await expandedBody.fill('Expanded editor content');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(body).toContainText('Expanded editor content');

  await expect(page.locator('#builder-workbook-html')).toHaveValue(/data-columns="2"/);
});
