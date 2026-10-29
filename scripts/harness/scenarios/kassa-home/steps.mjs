// KASSA-UX-1: een dienst doorlopen op gsm, tablet en desktop.
// Zaalplan → tafel 4 → 3× Pils (moet één lijn "3× Pils" worden) + 1 Cola → − op Pils → terug →
// toog-tegel → ⋯-menu (Kas, Rapporten, Naar beheer) → (KASSA-UX-2) Bar en Keuken, een barbon op Klaar.
// Meet ook of de pagina breder wordt dan het scherm.
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
  // KASSA-UX-3: Pils heeft een formaat → het venster blijft open, elke tik telt.
  await page.getByRole('button', { name: /^Pils/ }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^25 cl/ }).click();
  await shot('2a-formaat');
  await page.getByRole('button', { name: 'Klaar', exact: true }).click();
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
  await page.waitForTimeout(200);
  await shot('3b-tabs');
  await page.getByRole('button', { name: /^Alle \(/ }).click();
  await page.waitForTimeout(200);
  log('tabs in lijst', await page.getByRole('dialog').getByRole('listitem').count());
  await shot('3c-alle-tabs');
  await page.keyboard.press('Escape');
  // Lang drukken op tafel 4 (lijst op gsm, plan elders): actiemenu.
  const t4 = page.getByRole('button', { name: width < 600 ? /^4 / : /^Tafel 4[,:]/ }).first();
  await t4.dispatchEvent('contextmenu');
  await page.waitForTimeout(250);
  log('actiemenu', JSON.stringify(await page.getByRole('dialog').getByRole('button').allInnerTexts()));
  await shot('3d-tafelacties');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Toog \/ snelverkoop|^Toog$/ }).first().click();
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
  // KASSA-UX-2: terug naar Zaal (tablet: kolom Binnenkomend ernaast), dan Bar en Keuken.
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.waitForTimeout(300);
  log('binnenkomend naast zaalplan', await page.getByRole('complementary').count());
  await shot('7-zaal');
  await page.getByRole('button', { name: /^Bar/ }).click();
  await page.waitForTimeout(300);
  await shot('8-bar');
  await page.getByRole('button', { name: /^Start|^Starten|bereiden/i }).first().click().catch(() => log('geen startknop'));
  await page.getByRole('button', { name: /^Keuken/ }).click();
  await page.waitForTimeout(300);
  log('keukenbonnen', await page.locator('article').count());
  await shot('9-keuken');
  log('overflow keuken px', await overflow(page));
  // Taal: start in de taal van de zaak (nl); kies op dit toestel English en terug.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Taal' }).click();
  await page.getByRole('menuitem', { name: /English/ }).click();
  await page.waitForTimeout(300);
  log('na English', await page.getByRole('button', { name: /^Floor/ }).count(), await page.getByRole('button', { name: /^Kitchen/ }).count());
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Language' }).click();
  await page.getByRole('menuitem', { name: /Language of the business/ }).click();
  await page.waitForTimeout(300);
  log('terug naar zaak', await page.getByRole('button', { name: /^Zaal/ }).count());
}
