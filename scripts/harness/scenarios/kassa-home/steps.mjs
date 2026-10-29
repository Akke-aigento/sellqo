// KASSA-UX-1: een dienst doorlopen op gsm, tablet en desktop.
// Zaalplan → tafel 4 → 3× Pils (moet één lijn "3× Pils" worden) + 1 Cola → − op Pils → terug →
// toog-tegel → ⋯-menu (Kas, Rapporten, Naar beheer). Meet ook of de pagina breder wordt dan het scherm.
export const setup = {};
export const widths = [390, 1024, 1280];
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
export async function run(page, { width, shot, log }) {
  await page.waitForTimeout(600);
  if (width < 600) await page.getByRole('button', { name: 'Zaalplan' }).click();
  await page.waitForTimeout(300);
  await shot('0-zaalplan');
  if (width < 600) await page.getByRole('button', { name: 'Lijst' }).click();
  await page.getByRole('button', { name: width < 600 ? /^4 / : /^Tafel 4[,:]/ }).first().click();
  await page.waitForTimeout(400);
  await shot('1-tafel-open');
  await page.getByRole('button', { name: /Van de tap/ }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Pils/ }).first().click();
  await page.getByRole('button', { name: /Frisdrank/ }).click();
  await page.getByRole('button', { name: /^Cola €/ }).first().click();
  await page.getByRole('button', { name: /Van de tap/ }).click();
  await page.waitForTimeout(250);
  log('overflow px', await overflow(page));
  await shot('2-na-4-tikken');
  await page.getByRole('button', { name: 'Eén Pils minder' }).click();
  await page.waitForTimeout(200);
  if (width < 1024) { await page.getByRole('button', { name: /stuks/ }).click(); await page.waitForTimeout(200); }
  const lines = await page.locator('li button').allInnerTexts();
  log('lijnen', JSON.stringify(lines.map((x) => x.replace(/\s+/g, ' '))));
  await shot('3-rekening');
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.getByRole('button', { name: /Toog \/ snelverkoop/ }).click();
  await page.waitForTimeout(300);
  await shot('4-toog');
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForTimeout(200);
  log('naar beheer zichtbaar', await page.getByRole('menuitem', { name: 'Naar SellQo-beheer' }).count());
  await shot('5-menu');
  await page.getByRole('menuitem', { name: 'Kas', exact: true }).click();
  await page.waitForTimeout(300);
  await shot('6-kas');
  log('overflow eind px', await overflow(page));
}
