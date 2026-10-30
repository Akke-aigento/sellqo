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
  // RESERVATIE-1: tafel 2 paars, tafel 4 bezet met "res.", lijst van vandaag, lang drukken op tafel 2.
  log('overflow zaal px', await overflow(page));
  // VASTE-KLANT-1: vaste plek 'Bompa Ré' op het plan.
  log('vaste klant', await page.getByRole('button', { name: /Bompa Ré/ }).count());
  await page.getByRole('button', { name: /^Reservaties vandaag/ }).click();
  await page.waitForTimeout(200);
  log('lijst reservaties', (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 260));
  await shot('0a-reservaties');
  await page.keyboard.press('Escape');
  if (width < 600) await page.getByRole('button', { name: 'Lijst' }).click();
  const t2 = page.getByRole('button', { name: width < 600 ? /^2 / : /^Tafel 2[,:]/ }).first();
  log('tafel 2', (await t2.innerText()).replace(/\s+/g, ' '));
  log('tafel 4', (await page.getByRole('button', { name: width < 600 ? /^4 / : /^Tafel 4[,:]/ }).first().innerText()).replace(/\s+/g, ' '));
  await shot('0b-paars');
  await t2.dispatchEvent('contextmenu');
  await page.waitForTimeout(250);
  log('actiemenu gereserveerd', JSON.stringify(await page.getByRole('dialog').getByRole('button').allInnerTexts()));
  await shot('0c-tafel-gereserveerd');
  await page.keyboard.press('Escape');
  const t3 = page.getByRole('button', { name: width < 600 ? /^3 / : /^Tafel 3[,:]/ }).first();
  await t3.dispatchEvent('contextmenu');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Reserveren' }).click();
  await page.waitForTimeout(200);
  await shot('0d-reserveren');
  await page.keyboard.press('Escape');
  if (width < 600) await page.getByRole('button', { name: 'Zaalplan' }).click();
  await page.waitForTimeout(200);
  if (width < 600) await page.getByRole('button', { name: 'Lijst' }).click();
  await page.getByRole('button', { name: width < 600 ? /^4 / : /^Tafel 4[,:]/ }).first().click();
  await page.waitForTimeout(400);
  await shot('1-tafel-open');
  await page.getByRole('button', { name: /Van de tap/ }).click();
  // KASSA-UX-3: Pils heeft een formaat → het venster blijft open, elke tik telt.
  await page.getByRole('button', { name: /^Pils/ }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^25 cl/ }).click();
  // KASSA-UX-4: "−" per maat in het formaatvenster (3 → 2, en terug naar 3).
  await page.getByRole('button', { name: 'Eén Pils 25 cl minder' }).click();
  log('na − in formaatvenster', (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' '));
  await page.getByRole('button', { name: /^25 cl/ }).click();
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
  const lineTexts = async () => (await page.locator('li').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => /×/.test(x));
  log('lijnen', JSON.stringify(await lineTexts()));
  await shot('3-rekening');
  // KASSA-UX-4: + en − op de lijn zelf, en naar links vegen = weghalen (ontwerp-lijn).
  await page.getByRole('button', { name: 'Eén meer: Cola' }).click();
  await page.waitForTimeout(150);
  log('na + op Cola', JSON.stringify(await lineTexts()));
  const cola = page.locator('li', { hasText: 'Cola' }).first();
  const box = await cola.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x + box.width * 0.5 - i * 15, box.y + box.height / 2); if (i === 6) await shot('3a-vegen'); }
  await page.mouse.up();
  await page.waitForTimeout(250);
  log('na vegen Cola', JSON.stringify(await lineTexts()));
  // Verstuurde lijn: − opent "waarom annuleren", niets wordt stil gewijzigd.
  await page.getByRole('button', { name: 'Eén minder: Kriek' }).click();
  await page.waitForTimeout(200);
  log('− op verstuurde lijn opent', (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 120));
  await shot('3e-annuleren');
  await page.keyboard.press('Escape');
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
  // KASSA-UX-4: tafel met rekening gevraagd → "Rekening-vraag intrekken" (met bevestiging).
  const ter2 = page.getByRole('button', { name: width < 600 ? /^Ter-2 / : /^Tafel Ter-2[,:]/ }).first();
  if (await ter2.count()) {
    await ter2.dispatchEvent('contextmenu');
    await page.waitForTimeout(250);
    log('actiemenu rekening gevraagd', JSON.stringify(await page.getByRole('dialog').getByRole('button').allInnerTexts()));
    await page.getByRole('button', { name: 'Rekening-vraag intrekken' }).click();
    await shot('3f-intrekken');
    await page.keyboard.press('Escape');
  } else log('Ter-2 niet in beeld');
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
