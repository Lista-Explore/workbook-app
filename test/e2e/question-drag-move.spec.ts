import { test, expect, type Locator, type Page } from '@playwright/test';

async function dragQuestions(page: Page, handle: Locator, dropZone: Locator) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await handle.dispatchEvent('dragstart', { dataTransfer });
  await dropZone.dispatchEvent('dragover', { dataTransfer });
  await dropZone.dispatchEvent('drop', { dataTransfer });
}

test('builder moves one or more questions between standalone and section columns by drag and drop', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=question-drag-move-e2e');
  await page.locator('#builder-workbook-title').fill('Question move test');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const editor = page.locator('#builder-section-editor');

  await editor.getByRole('button', { name: '+ Add section', exact: true }).click();
  const section = editor.locator('.builder-section-card').first();
  await section.locator('.builder-section-title-input').fill('Main section');
  await section.locator('label', { hasText: 'Columns' }).locator('select').selectOption('2');

  const columns = section.locator('.builder-field-column');
  await columns.nth(0).getByRole('button', { name: '+ Add question', exact: true }).click();
  await columns.nth(0).locator('.builder-field-label-input').last().fill('Inside A');
  await columns.nth(0).getByRole('button', { name: '+ Add question', exact: true }).click();
  await columns.nth(0).locator('.builder-field-label-input').last().fill('Inside B');

  const outside = editor.locator(':scope > .builder-fields-container').last();
  await outside.getByRole('button', { name: '+ Add question', exact: true }).click();
  await outside.locator('.builder-field-label-input').last().fill('Outside C');

  await dragQuestions(
    page,
    outside.locator('.builder-drag-handle').first(),
    columns.nth(1).locator('.builder-field-drop-zone')
  );

  await expect.poll(() => columns.nth(1).locator('.builder-field-label-input').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(['Outside C']);
  await expect(page.locator('#builder-workbook-html')).toHaveValue(/Outside C/);

  await section.locator('.builder-field-row').first().locator('.builder-field-select').check();
  await columns.nth(1).locator('.builder-field-row').first().locator('.builder-field-select').check();
  await dragQuestions(
    page,
    columns.nth(1).locator('.builder-drag-handle').first(),
    editor.locator(':scope > .builder-fields-container').last().locator('.builder-field-drop-zone')
  );

  const finalOutside = editor.locator(':scope > .builder-fields-container').last();
  await expect.poll(() => finalOutside.locator('.builder-field-label-input').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(['Inside A', 'Outside C']);
  await expect.poll(() => columns.nth(0).locator('.builder-field-label-input').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(['Inside B']);
});
