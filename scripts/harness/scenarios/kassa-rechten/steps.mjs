// KASSA-RECHTEN-1 + KASSA-UX-6 als ober (Tom): korting/annuleren vraagt de PIN van een verantwoordelijke,
// herhaal vorige ronde, vegen met "Ongedaan maken", opmerking bewaart bij sluiten, toog op naam,
// lege rekening schrappen met bevestiging, afrekenen (fooi, €5/€10, per persoon), Mijn dienst, kas tellen, Bar.
export const setup = {};
export const widths = [390, 1280];
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const dialogText = async (page) => (await page.getByRole('dialog').last().innerText()).replace(/\s+/g, ' ').slice(0, 300);
export async function run(page, ctx) {
  try { await steps(page, ctx); } catch (e) { ctx.log('STAP FOUT', String(e).slice(0, 400)); await ctx.shot('fout'); throw e; }
}
async function steps(page, { width, shot, log }) {
  await page.waitForTimeout(600);
  if (width < 600) { await page.getByRole('button', { name: 'Lijst' }).click(); await page.waitForTimeout(200); }
  await page.getByRole('button', { name: width < 600 ? /^4 / : /^Tafel 4[,:]/ }).first().click();
  await page.waitForTimeout(400);
  if (width < 1024) { await page.getByRole('button', { name: /stuks/ }).click(); await page.waitForTimeout(200); }
  // 1. Verstuurde lijn → korting met schildje → PIN van een verantwoordelijke.
  await page.locator('li', { hasText: 'Kriek' }).first().getByRole('button').first().click();
  await page.waitForTimeout(250);
  log('lijnvenster', await dialogText(page));
  await shot('1-lijn-schild');
  await page.getByRole('button', { name: /−10 %/ }).click();
  await page.waitForTimeout(300);
  log('akkoord', await dialogText(page));
  await shot('2-pin-verantwoordelijke');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // Annuleren van een verstuurde lijn: reden kiezen → ook het akkoord.
  await page.getByRole('button', { name: 'Annuleren', exact: true }).click();
  await page.getByRole('button', { name: 'Kapot of gemorst' }).click();
  await page.waitForTimeout(250);
  log('akkoord annuleren', await dialogText(page));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // 2. ⋯ → Herhaal vorige ronde.
  await page.getByRole('button', { name: 'Meer', exact: true }).click();
  await page.waitForTimeout(200);
  log('menu tafel', JSON.stringify(await page.getByRole('menuitem').allInnerTexts()));
  await shot('3-menu-herhaal');
  await page.getByRole('menuitem', { name: 'Herhaal vorige ronde' }).click();
  await page.waitForTimeout(300);
  const lineTexts = async () => (await page.locator('li').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => /×/.test(x));
  log('na herhaal', JSON.stringify(await lineTexts()));
  await shot('4-herhaald');
  // 3. Ontwerp-lijn vegen → melding met Ongedaan maken.
  const kriek = page.locator('li', { hasText: 'Kriek' }).last();
  const box = await kriek.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * 0.6 - i * 15, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  log('na vegen', JSON.stringify(await lineTexts()));
  await shot('5-vegen-ongedaan');
  // Sonner laat de melding na de klik meteen wegschuiven; Playwright ziet dat soms als 'niet stabiel'.
  await page.getByRole('button', { name: 'Ongedaan maken' }).click({ timeout: 5000 }).catch(() => log('klik Ongedaan maken: melding schoof weg'));
  await page.waitForTimeout(250);
  log('na ongedaan', JSON.stringify(await lineTexts()));
  // 4. Opmerking zonder Opslaan, venster sluiten → blijft bewaard.
  await page.locator('li', { hasText: 'Bittergarnituur' }).last().getByRole('button').first().click();
  await page.waitForTimeout(200);
  await page.getByLabel('Opmerking').fill('zonder salami');
  await page.getByRole('button', { name: 'Sluiten' }).click();
  await page.waitForTimeout(250);
  log('opmerking bewaard', await page.getByText('zonder salami').count());
  await shot('6-opmerking');
  // Afrekenen op tafel 4 (verstuurde lijnen): fooi-knoppen, €5/€10, per persoon.
  await page.getByRole('button', { name: /^Afrekenen/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('dialog').getByRole('button', { name: 'Contant', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '10 %' }).click();
  await page.waitForTimeout(150);
  log('afrekenen', await dialogText(page));
  await shot('9-afrekenen-fooi');
  await page.getByRole('dialog').getByRole('button', { name: '3', exact: true }).click();
  await page.waitForTimeout(150);
  await page.locator('div[aria-live="polite"]').getByRole('button', { name: 'Overschrijving', exact: true }).click();
  await page.getByRole('button', { name: 'Volgende persoon' }).click();
  await page.waitForTimeout(150);
  log('per persoon', await dialogText(page));
  await shot('10-per-persoon');
  log('overflow afrekenen px', await overflow(page));
  await page.getByRole('dialog').getByRole('button', { name: 'Annuleren', exact: true }).click();
  await page.waitForTimeout(200);
  // 5. Terug, toog: product, ⋯ (op naam / schrappen met bevestiging), afrekenen.
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Toog \/ snelverkoop|^Toog$/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Van de tap/ }).click();
  await page.getByRole('button', { name: /^Wit bier/ }).first().click();
  await page.getByRole('button', { name: /^Wit bier/ }).first().click();
  await page.getByRole('button', { name: /^Tripel/ }).first().click();
  await page.getByRole('button', { name: 'Meer', exact: true }).click();
  await page.waitForTimeout(200);
  log('menu toog', JSON.stringify(await page.getByRole('menuitem').allInnerTexts()));
  await page.getByRole('menuitem', { name: 'Rekening schrappen' }).click();
  await page.waitForTimeout(200);
  log('bevestiging schrappen', await dialogText(page));
  await shot('7-schrappen-bevestigen');
  await page.getByRole('button', { name: 'Annuleren' }).click();
  await page.getByRole('button', { name: 'Meer', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Op naam of naar een tafel zetten' }).click();
  await page.waitForTimeout(250);
  await shot('8-toog-op-naam');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.waitForTimeout(200);
  // 6. Mijn dienst, kas tellen, Bar met toogknop.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Mijn dienst' }).click();
  await page.waitForTimeout(300);
  await shot('11-mijn-dienst');
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Kas', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Shift openen|openen/i }).first().click().catch(() => log('geen shift-openen-knop'));
  await page.getByRole('button', { name: 'Tellen per biljet en munt' }).click();
  await page.getByLabel('Aantal van € 50,00').fill('2');
  await page.getByLabel('Aantal van € 2,00').fill('7');
  await page.getByLabel('Aantal van € 0,50').fill('3');
  await page.waitForTimeout(150);
  log('kas totaal veld', await page.getByLabel('Bedrag').inputValue().catch(() => '?'));
  await shot('12-kas-tellen');
  log('overflow kas px', await overflow(page));
  // Review 1: kas uit door een ober = eerst het akkoord van een verantwoordelijke (vóór het ondertekenen).
  await page.getByRole('button', { name: 'Kas uit' }).click();
  await page.getByLabel('Bedrag').fill('20');
  await page.getByLabel('Reden', { exact: true }).fill('Brood bij de bakker');
  await page.getByRole('button', { name: 'Bevestigen' }).click();
  await page.waitForTimeout(300);
  log('kas uit akkoord', await dialogText(page));
  await shot('12b-kas-uit-akkoord');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Terug naar de tafels' }).click();
  await page.getByRole('button', { name: /^Bar/ }).click();
  await page.waitForTimeout(300);
  await shot('13-bar-toog');
  log('toogknop in bar', await page.getByRole('button', { name: /Toog \/ snelverkoop/ }).count());
}
