import { test, expect } from '@playwright/test';
import { PDFDocument } from '../../src/vendor/pdf-lib.esm.js';

test('builder supports checklist progress and rich text answers through preview, published HTML, and PDF', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=rich-text-checklist-e2e');
  await page.locator('#builder-workbook-title').fill('Checklist and rich text test');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await page.getByRole('button', { name: '+ Add section', exact: true }).click();

  const section = page.locator('.builder-section-card').first();
  await section.locator('.builder-add-field-type-select').first().selectOption('checklist');
  await section.locator('.builder-add-field-btn').first().click();
  await section.locator('.builder-field-label-input').first().fill('Launch steps');
  await section.locator('.builder-checklist-item-input').nth(0).fill('Plan');
  await section.locator('.builder-checklist-item-input').nth(1).fill('Build');
  const firstItem = section.locator('.builder-checklist-item-input').first();
  await firstItem.fill('Plan\nReview the brief');
  await firstItem.press('ControlOrMeta+a');
  await section.locator('.builder-checklist-option-row').first().locator('.wb-rich-text-format').selectOption('H2');
  const secondItem = section.locator('.builder-checklist-item-input').nth(1);
  await secondItem.press('ControlOrMeta+a');
  await section.locator('.builder-checklist-option-row').nth(1).getByRole('button', { name: 'Bold', exact: true }).click();

  await section.locator('.builder-add-field-type-select').last().selectOption('rich-text');
  await section.locator('.builder-add-field-btn').last().click();
  await section.locator('.builder-field-label-input').last().fill('Reflection');

  await expect(page.locator('#builder-workbook-html')).toHaveValue(/data-field-type="checklist"/);
  await expect(page.locator('#builder-workbook-html')).toHaveValue(/data-field-type="rich-text"/);

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = page.locator('#builder-preview-panel');
  await expect(preview.locator('.wb-checklist-progress')).toHaveText('0 of 2 done');
  await preview.locator('.wb-checklist-item input').first().check();
  await expect(preview.locator('.wb-checklist-progress')).toHaveText('1 of 2 done');
  await expect(preview.locator('.wb-checklist-meter')).toHaveJSProperty('value', 1);
  await expect(preview.locator('.wb-checklist-item label').first().locator('h2').first()).toContainText('Plan');
  await expect(preview.locator('.wb-checklist-item label').nth(1).locator('b,strong').first()).toContainText('Build');

  const richText = preview.locator('.wb-rich-text-input');
  await richText.fill('Formatted response');
  await richText.press('ControlOrMeta+a');
  await preview.getByRole('button', { name: 'Bold' }).click();
  await expect(richText.locator('strong,b')).toHaveText('Formatted response');
  await preview.locator('.wb-rich-text-format').selectOption('H2');
  await expect(richText.locator('h2')).toContainText('Formatted response');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    preview.locator('#wb-download-pdf-btn').click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const pdfDoc = await PDFDocument.load(await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }));
  const form = pdfDoc.getForm();
  expect(form.getCheckBox('new-question__opt__0').isChecked()).toBe(true);
  expect(form.getCheckBox('new-question__opt__1').isChecked()).toBe(false);
  expect(() => form.getTextField('new-question-2')).toThrow();
});
