import { test, expect } from '@playwright/test';

async function readBuilderDraft(page, draftKey: string) {
  return page.evaluate((key) =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open('lms-workbook-store', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workbooks', 'readonly');
        const get = tx.objectStore('workbooks').get(`draft:${key}:draft`);
        get.onerror = () => reject(get.error);
        get.onsuccess = () => resolve(get.result?.value || null);
      };
    }), draftKey);
}

test('Content formatting survives preview, structural edits, and draft reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/builder/index.html?draftKey=content-formatting');
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
  await expect
    .poll(() => readBuilderDraft(page, 'content-formatting'))
    .toMatchObject({ title: 'Content workbook', worksheets: expect.any(Array) });
  await expect
    .poll(() => readBuilderDraft(page, 'content-formatting').then((draft: any) => JSON.stringify(draft)))
    .toContain('Formatted content');
  await page.reload();
  const reloadedBody = page.locator('[contenteditable="true"][aria-label="Content text"]');
  await expect(reloadedBody.locator('strong,b')).toHaveText('Formatted content');
  await page.getByRole('button', { name: '+ Add section', exact: true }).click();
  await expect(reloadedBody.locator('strong,b')).toHaveText('Formatted content');
  expect(errors).toEqual([]);
});

test('published Content image alignment and sizing render in workbook HTML', async ({ page }) => {
  await page.goto('/builder/index.html');
  await page.setContent(`
    <link rel="stylesheet" href="/src/styles.css">
    <div class="lms-workbook">
      <div class="wb-content" style="width: 600px; border: 0;">
        <div class="se-component se-image-container __se__float-center" style="min-width: 100%; width: 50%;">
          <figure style="width: 50%;">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='black'/%3E%3C/svg%3E" alt="Centered" style="width: 100%;" data-align="center" data-percentage="50," data-size="50%,">
          </figure>
        </div>
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
  expect(imageBox!.width).toBeGreaterThan(298);
  expect(imageBox!.width).toBeLessThan(302);
});

test('published Content keeps its layout inside an LMS page with broad host styles', async ({ page }) => {
  await page.goto('/builder/index.html');
  await page.setContent(`
    <style>
      .course-page img { display: inline; max-width: none; height: 88px; }
      .course-page .se-component { display: block; }
      .course-page ul, .course-page ol { margin: 40px; padding-left: 0; }
      .course-page table td { border: 0; padding: 0; }
    </style>
    <link rel="stylesheet" href="/src/styles.css">
    <div class="course-page">
      <div class="lms-workbook">
        <div class="wb-content" style="width: 600px;">
          <div class="se-component se-image-container __se__float-center" style="min-width: 100%; width: 50%;">
            <figure style="width: 50%;">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Crect width='200' height='100' fill='black'/%3E%3C/svg%3E" alt="Centered" style="width: 100%;" data-align="center" data-percentage="50," data-size="50%,">
            </figure>
          </div>
          <ul><li>First</li><li>Second</li></ul>
          <table><tr><td>Cell</td></tr></table>
        </div>
      </div>
    </div>
  `);

  await expect.poll(() => page.locator('.wb-content img').evaluate((node) => getComputedStyle(node).display)).toBe('block');
  await expect.poll(() => page.locator('.wb-content .se-component').evaluate((node) => getComputedStyle(node).display)).toBe('flex');
  await expect.poll(() => page.locator('.wb-content ul').evaluate((node) => getComputedStyle(node).paddingLeft)).toBe('32px');
  await expect.poll(() => page.locator('.wb-content td').evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe('1px');
});

test('Content editor can expand from multi-column builder sections without changing published columns', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=content-columns');
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

  await expect
    .poll(() =>
      section.locator('.builder-content-editor .se-toolbar').first().evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { position: style.position, top: Math.round(rect.top), width: Math.round(rect.width) };
      })
    )
    .toMatchObject({ position: 'relative', width: expect.any(Number) });

  await expect(page.locator('#builder-workbook-html')).toHaveValue(/data-columns="2"/);
});
