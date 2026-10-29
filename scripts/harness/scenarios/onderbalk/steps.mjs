export const setup = { tracks: ['horeca'] };
export async function run(page, { width, shot, log }) {
  if (width !== 390) return;
  await page.getByRole('button', { name: 'Weghalen', exact: true }).nth(1).click();
  await page.locator('button:has(svg.lucide-plus)').first().click();
  await page.waitForTimeout(300);
  log('balk:', (await page.locator('nav').last().innerText()).replace(/\n/g, ' · '));
  await shot('aangepast');
}
