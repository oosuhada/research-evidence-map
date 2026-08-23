import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedWorkspace } from './helpers';

test('keyboard/list workflow has no serious or critical axe violations', async ({ page, request }) => {
  test.setTimeout(90_000);
  const { workspace } = await seedWorkspace(request, { evidenceCount: 8, opportunity: true });
  await page.goto(`/w/${workspace.id}?view=list`);
  await expect(page.getByRole('heading', { name: 'Evidence List' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .analyze();
  const severe = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(severe, severe.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
});

test('canvas always has a keyboard-accessible list alternative', async ({ page, request }) => {
  const { workspace } = await seedWorkspace(request, { evidenceCount: 4 });
  await page.goto(`/w/${workspace.id}?view=map`);
  await expect(page.getByLabel('Evidence map')).toBeVisible();
  const listButton = page.getByRole('button', { name: 'Evidence List' });
  await listButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Evidence List' })).toBeVisible();
});
