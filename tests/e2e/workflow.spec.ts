import { expect, test } from '@playwright/test';

test('real UI workflow imports three interviews, reviews, clusters, challenges, traces and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Workspace name').fill(`UI acceptance ${Date.now()}`);
  await page.getByLabel('Research question / description').fill('Validate evidence-backed onboarding discovery.');
  await page.getByRole('button', { name: /Open a new field/ }).click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);

  await page.getByLabel('Document name').fill('Interview · Growth lead');
  await page.getByLabel('Paste text').fill('I need exact source evidence because I cannot trust a recommendation that I cannot trace.');
  await page.getByLabel('Participant').fill('Growth lead');
  await page.locator('.drop-card input[type="file"]').setInputFiles([
    { name: 'interview-support.md', mimeType: 'text/markdown', buffer: Buffer.from('The workflow is slow and I lose time rebuilding context around the decision.') },
    { name: 'interview-pm.txt', mimeType: 'text/plain', buffer: Buffer.from('However, showing every citation all the time can distract routine product work.') },
  ]);
  await page.getByRole('button', { name: /Preview 3 sources/ }).click();
  await expect(page.getByTestId('import-preview')).toContainText('analysis has not started');
  await expect(page.getByTestId('import-preview').locator('article')).toHaveCount(3);
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.locator('.source-register article')).toHaveCount(3);
  await expect(page.getByText('No analysis run yet.')).toBeVisible();

  await page.getByRole('button', { name: /Analyze 3 sources/ }).click();
  await expect(page.locator('.analysis-actions')).toContainText('SUCCEEDED');
  await page.getByRole('button', { name: 'Evidence List' }).click();
  await expect(page.getByRole('heading', { name: 'Evidence List' })).toBeVisible();
  await expect(page.locator('.evidence-row')).toHaveCount(3);

  await page.locator('.row-main').first().click();
  await expect(page.getByRole('complementary', { name: 'Evidence inspector' })).toContainText('¶1');
  await page.getByLabel('Review state').selectOption('accepted');
  await page.getByRole('button', { name: 'Save human edit' }).click();
  await expect(page.getByLabel('Review state')).toHaveValue('accepted');
  const evidenceUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(evidenceUrl);
  await expect(page.getByRole('complementary', { name: 'Evidence inspector' })).toContainText('SOURCE TRACE');
  await page.getByRole('button', { name: 'Close evidence inspector' }).click();

  const evidenceCheckboxes = page.locator('.evidence-row .row-select input');
  await evidenceCheckboxes.nth(0).check();
  await evidenceCheckboxes.nth(1).check();
  await page.getByPlaceholder('Cluster label').fill('Research confidence');
  await page.getByRole('button', { name: 'Create (2)' }).click();
  await expect(page.locator('.cluster-list')).toContainText('Research confidence');

  const clusterCheckboxes = page.getByRole('group', { name: 'Select clusters to merge' }).getByRole('checkbox');
  if (await clusterCheckboxes.count() >= 2) {
    await clusterCheckboxes.nth(0).check();
    await clusterCheckboxes.nth(1).check();
    await page.getByPlaceholder('Merged label').fill('Merged decision evidence');
    await page.getByRole('button', { name: 'Merge (2)' }).click();
    await expect(page.locator('.cluster-list')).toContainText('Merged decision evidence');
  }

  await evidenceCheckboxes.nth(0).check();
  await evidenceCheckboxes.nth(1).check();
  await page.getByLabel('Opportunity title').fill('Evidence on demand');
  await page.getByLabel('Hypothesis').fill('Reveal source context when the decision is challenged, without forcing a permanent citation wall.');
  await page.getByRole('button', { name: /Create from 2 selected signals/ }).click();
  await expect(page.locator('.opportunity-list')).toContainText('Evidence on demand');
  await page.getByRole('button', { name: /Challenge this opportunity/ }).click();
  await expect(page.locator('.challenge-note blockquote')).toContainText('Challenge:');

  const markdown = page.getByRole('link', { name: /Markdown opportunity brief/ });
  const downloadPromise = page.waitForEvent('download');
  await markdown.click();
  const download = await downloadPromise;
  expect(await download.suggestedFilename()).toMatch(/brief\.md$/);

  await page.reload();
  await expect(page.locator('.opportunity-list')).toContainText('Evidence on demand');
  await expect(page.locator('.analysis-actions')).toContainText('SUCCEEDED');
});
