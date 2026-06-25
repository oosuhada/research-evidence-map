import { expect, test } from '@playwright/test';
import { seedWorkspace } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile defaults to Evidence List and Focused Map does not depend on pinch zoom', async ({ page, request }) => {
  const { workspace } = await seedWorkspace(request, { evidenceCount: 6, opportunity: true });
  await page.goto(`/w/${workspace.id}`);
  await expect(page.getByRole('heading', { name: 'Evidence List' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Focused Map' })).toBeVisible();

  const hero = await page.locator('.workspace-hero h1').boundingBox();
  const evidenceStage = await page.locator('#evidence').boundingBox();
  expect(hero).not.toBeNull();
  expect(evidenceStage).not.toBeNull();
  expect((hero?.y ?? 0) + (hero?.height ?? 0)).toBeLessThan(evidenceStage?.y ?? Number.MAX_SAFE_INTEGER);

  await page.getByRole('button', { name: 'Focused Map' }).click();
  await expect(page.getByLabel('Focused cluster')).toBeVisible();
  await expect(page.getByLabel('Evidence map')).toBeVisible();
  await expect(page.locator('.react-flow__controls')).toHaveCount(0);
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0);

  const mapButtonBox = await page.getByRole('button', { name: 'Focused Map' }).boundingBox();
  expect(mapButtonBox?.height).toBeGreaterThanOrEqual(44);
  await page.locator('.evidence-map-node').first().click();
  const sheet = page.getByRole('complementary', { name: 'Evidence inspector' });
  await expect(sheet).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox?.height ?? 1000).toBeLessThan(720);
  const closeBox = await page.getByRole('button', { name: 'Close evidence inspector' }).boundingBox();
  expect(closeBox?.height).toBeGreaterThanOrEqual(44);
});
