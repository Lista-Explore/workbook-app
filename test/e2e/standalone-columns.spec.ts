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

test('standalone questions can mix full-width and two-column layouts without a section', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=standalone-mixed-columns-e2e');
  await page.locator('#builder-workbook-title').fill('Standalone mixed columns');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  const editor = page.locator('#builder-section-editor');
  let standaloneBlocks = editor.locator(':scope > .builder-standalone-block');
  const firstBlock = standaloneBlocks.last();
  await firstBlock.getByRole('button', { name: '+ Add question', exact: true }).click();
  await firstBlock.locator('.builder-field-label-input').last().fill('Full width question');
  await firstBlock.getByRole('button', { name: '+ Start new no-section layout', exact: true }).click();

  standaloneBlocks = editor.locator(':scope > .builder-standalone-block');
  await expect(standaloneBlocks).toHaveCount(2);
  const secondBlock = standaloneBlocks.nth(1);
  await secondBlock.locator('.builder-columns-control select').selectOption('2');

  const columns = secondBlock.locator('.builder-field-column');
  await columns.nth(0).getByRole('button', { name: '+ Add question', exact: true }).click();
  await columns.nth(0).locator('.builder-field-label-input').last().fill('Left question');
  await columns.nth(1).getByRole('button', { name: '+ Add question', exact: true }).click();
  await columns.nth(1).locator('.builder-field-label-input').last().fill('Right question');

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const previewBlocks = page.locator('#builder-preview-panel .wb-section[data-unsectioned="true"]');
  await expect(previewBlocks).toHaveCount(2);
  await expect(previewBlocks.nth(0).locator('.wb-section-fields')).toHaveAttribute('data-columns', '1');
  await expect(previewBlocks.nth(0).locator('.wb-field-label')).toHaveText('Full width question');
  await expect(previewBlocks.nth(1).locator('.wb-section-fields')).toHaveAttribute('data-columns', '2');
  await expect(previewBlocks.nth(1).locator('.wb-column').nth(0).locator('.wb-field-label')).toHaveText('Left question');
  await expect(previewBlocks.nth(1).locator('.wb-column').nth(1).locator('.wb-field-label')).toHaveText('Right question');
});
