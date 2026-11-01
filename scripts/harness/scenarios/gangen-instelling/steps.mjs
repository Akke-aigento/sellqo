// GANGEN-1: de kaart met gangen aan; Desserts op "Dessert" zetten; gangen uit = enkel de schakelaar.
export const setup = {};
export async function run(page, { shot, log }) {
  await page.waitForTimeout(400);
  log('keuzes', JSON.stringify(await page.locator('select').evaluateAll((els) => els.map((e) => e.value))));
  await page.getByRole('combobox', { name: 'Gang voor Desserts' }).selectOption('3');
  await page.waitForTimeout(300);
  log('na Desserts', await page.getByRole('combobox', { name: 'Gang voor Desserts' }).inputValue());
  await shot('1-dessert');
  await page.getByRole('switch', { name: 'Gangen gebruiken' }).click();
  await page.waitForTimeout(300);
  log('lijst na uit', await page.locator('select').count());
  await shot('2-uit');
}
