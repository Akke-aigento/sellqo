// ALLERGEEN-VERKLAARD-1: de drie standen, daarna "bevat geen" aanvinken op de eerste kaart.
export const setup = {};
export async function run(page, { width, shot, log }) {
  await page.getByText('Melk (lactose)').nth(2).waitFor();
  log('overflow px', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
  const boxes = page.getByRole('checkbox', { name: 'Bevat geen van de 14 allergenen' });
  log('bevat-geen standen', JSON.stringify(await boxes.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-state')}${e.hasAttribute('disabled') ? '/uit' : ''}`))));
  await boxes.first().click();
  await page.waitForTimeout(300);
  log('bewaard', JSON.stringify(await page.evaluate(() => window.__updates)));
  await shot('na-aanvinken');
}
