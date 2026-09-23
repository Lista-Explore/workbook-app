import { test, expect } from '@playwright/test';

test('standalone questions can use columns without adding a section', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=standalone-columns-e2e');
  await page.locator('#builder-workbook-title').fill('Standalone columns');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  const editor = page.locator('#builder-section-editor');
  const standalone = editor.locator(':scope > .builder-standalone-block').last();
  await standalone.locator('.builder-columns-control select').selectOption('2');

  const columns = standalone.locator('.builder-field-column');
  await expect(columns).toHaveCount(2);
  await columns.nth(1).getByRole('button', { name: '+ Add question', exact: true }).click();
  await columns.nth(1).locator('.builder-field-label-input').last().fill('Standalone column B');

  await expect.poll(() => page.locator('#builder-workbook-html').inputValue()).toContain('data-unsectioned="true"');
  await expect(page.locator('#builder-workbook-html')).toHaveValue(/data-columns="2"/);

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const previewFields = page.locator('#builder-preview-panel .wb-section[data-unsectioned="true"] .wb-section-fields');
  await expect(previewFields).toHaveAttribute('data-columns', '2');
  await expect(previewFields.locator('.wb-column').nth(1).locator('.wb-field-label')).toHaveText('Standalone column B');
});
