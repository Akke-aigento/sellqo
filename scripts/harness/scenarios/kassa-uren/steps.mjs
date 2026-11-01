export async function run(page, { shot, log }) {
  log('open:', await page.getByText('ingeklokt sinds').count());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log('horizontale overloop px:', overflow);
  await page.getByRole('button', { name: 'Afsluiten' }).first().click();
  await page.waitForTimeout(300);
  await shot('correctie');
}
