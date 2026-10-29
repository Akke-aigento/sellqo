// Zaakvoerder zonder kassa: naam laten staan, aanmaken, toestel gekoppeld. Personeel: enkel uitleg.
export const setup = { terminals: [], role: 'tenant_admin' };
export async function run(page, { width, shot, log }) {
  await page.getByRole('button', { name: 'Kassa aanmaken' }).click();
  await page.locator('#gekoppeld').waitFor();
  log(await page.locator('#gekoppeld').innerText(), JSON.stringify(await page.evaluate(() => window.__inserted)));
  if (width !== 390) return;
  await page.evaluate(() => { window.__harness = { terminals: [], role: 'staff' }; });
  await page.addInitScript(() => { window.__harness = { terminals: [], role: 'staff' }; });
  await page.reload(); await page.waitForTimeout(800);
  log('personeel ziet knop?', await page.getByRole('button', { name: 'Kassa aanmaken' }).count());
  await shot('personeel');
}
