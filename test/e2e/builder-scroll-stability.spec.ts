import { test, expect } from '@playwright/test';

test('builder keeps scroll position stable while editing fields', async ({ page }) => {
  await page.goto('/builder/index.html?draftKey=builder-scroll-stability-e2e');
  await page.locator('#builder-workbook-title').fill('Scroll stability');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  const editor = page.locator('#builder-section-editor');
  const standalone = editor.locator(':scope > .builder-standalone-block').last();
  for (let i = 1; i <= 24; i += 1) {
    await standalone.getByRole('button', { name: '+ Add question', exact: true }).click();
    await standalone.locator('.builder-field-label-input').last().fill(`Question ${i}`);
  }

  await page.locator('.builder-field-row').last().scrollIntoViewIfNeeded();
  const beforeTextEdit = await page.evaluate(() => window.scrollY);
  expect(beforeTextEdit).toBeGreaterThan(0);

  await page.locator('.builder-field-label-input').last().fill('Edited question');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(beforeTextEdit - 2);
  await page.waitForTimeout(700);
  await expect(page.evaluate(() => window.scrollY)).resolves.toBeGreaterThanOrEqual(beforeTextEdit - 2);

  const beforeRebuild = await page.evaluate(() => window.scrollY);
  await page.locator('.builder-field-row').last().getByText('Required', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(beforeRebuild - 2);
  await page.waitForTimeout(700);
  await expect(page.evaluate(() => window.scrollY)).resolves.toBeGreaterThanOrEqual(beforeRebuild - 2);
});
