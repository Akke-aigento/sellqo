// FIXES-0711 — zaalplan "Klaar" + toast, en zijbalk/onderbalk met dezelfde grenzen. Gooit bij een afwijking.
export const setup = {};
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  const open = async (qs, name) => {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${name}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${name}] ${m.text()}`); });
    await p.goto(`${base}?${qs}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(500);
    return p;
  };
  const shot = (p, n) => p.screenshot({ path: `/tmp/harness/fixes-0711-${width}-${n}.png`, fullPage: true });

  // 2 — tafel voor een vaste klant toevoegen, naam typen, Klaar.
  {
    const p = await open('screen=floor', 'floor');
    await p.getByRole('button', { name: 'Tafel toevoegen' }).click();
    await p.getByRole('menuitem', { name: 'Vaste klant' }).click();
    await p.waitForTimeout(400);
    await shot(p, 'paneel');
    const klaar = p.getByRole('button', { name: 'Klaar' });
    if (!(await klaar.isVisible())) errors.push(`[${width}] geen Klaar-knop`);
    if (!(await p.getByText('Wijzigingen worden meteen bewaard.').isVisible())) errors.push(`[${width}] geen autosave-hint`);
    const label = p.getByLabel('Naam').last();
    await label.fill('Jef');
    await klaar.click();
    await p.waitForTimeout(500);
    await shot(p, 'na-klaar');
    const writes = await p.evaluate(() => window.__writes ?? []);
    log('floor writes:', writes.join(' | '));
    if (!writes.some((w) => w.startsWith('updateTable') && w.includes('"label":"Jef"'))) errors.push(`[${width}] naam niet bewaard bij Klaar`);
    if (!(await p.getByText('Opgeslagen').first().isVisible())) errors.push(`[${width}] geen toast Opgeslagen`);
    if (await klaar.isVisible().catch(() => false)) errors.push(`[${width}] paneel niet gesloten na Klaar`);
    await p.close();
  }

  // 4 — zijbalk zonder Personaliseer menu; onderbalk-keuze zonder kind-items van verborgen parents.
  for (const [qs, name] of [['screen=sidebar&tracks=horeca', 'horeca'], ['screen=sidebar&tracks=webshop', 'webshop']]) {
    const p = await open(qs, name);
    if (width < 768) { await p.getByRole('button', { name: 'menu' }).click(); await p.waitForTimeout(400); }
    const side = (await p.locator('[data-sidebar="sidebar"]').last().innerText()).replace(/\n/g, ' · ');
    if (width < 768) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    const main = (await p.locator('main').innerText()).replace(/\n/g, ' · ');
    log(name, 'zijbalk:', side);
    log(name, 'onderbalk-kiezer:', main);
    if (/Personaliseer/i.test(side)) errors.push(`[${width} ${name}] Personaliseer menu staat er nog`);
    // Pakket zonder social_commerce: Advertenties en zijn kinderen nergens. Horeca: geen Categorieën (webshop).
    for (const bad of ['Bol.com', 'AI Regels', 'Product Mapping']) if (main.includes(bad)) errors.push(`[${width} ${name}] onderbalk biedt ${bad}`);
    if (name === 'horeca' && main.includes('Categorieën')) errors.push(`[${width} horeca] onderbalk biedt Categorieën`);
    await shot(p, `zijbalk-${name}`);
    await p.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
