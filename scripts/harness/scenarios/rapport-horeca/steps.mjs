export async function run(page, { shot, log }) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log('horizontale overloop px:', overflow);
  await page.getByText('Z-rapport nr. 105').click();
  await page.waitForTimeout(500);
  await shot('z-open');
}
