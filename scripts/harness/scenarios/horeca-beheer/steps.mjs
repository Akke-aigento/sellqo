// Elk scherm op 390 en 1280 px; de zijbalk ook als combinatie horeca + webshop.
export const setup = {};
const screens = [
  ['sidebar', ''], ['sidebar', '&tracks=horeca,webshop'], ['zaal', ''], ['zaal-edit', ''],
  ['bestellen', ''], ['bestellen', '&tab=qr'], ['bestellen', '&tab=allergens'], ['bestellen', '&tab=zaal'], ['settings', ''], ['settings-accounting', ''], ['settings-accounting', '&plan=pro'], ['reports', ''], ['kaart', ''], ['kaart', '&role=staff'],
];
// Per scherm een vers tabblad: tien schermen na elkaar in één tabblad laat chromium hier crashen
// (geheugen); fouten tellen net zoals in shoot.mjs.
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const [s, extra] of screens) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${s}${extra}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${s}${extra}] ${m.text()}`); });
    const name = `${s}${extra.replace(/[&=,]/g, '_')}`;
    const shot = (n) => p.screenshot({ path: `/tmp/harness/horeca-beheer-${width}-${n}.png`, fullPage: true });
    await p.goto(`${base}?screen=${s}${extra}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(600);
    if (s === 'sidebar') {
      if (width < 768) { await p.getByRole('button', { name: 'menu' }).click(); await p.waitForTimeout(400); }
      log(name, (await p.locator('[data-sidebar="content"]').last().innerText()).replace(/\n/g, ' · '));
    }
    if (s === 'kaart') {
      const fc = p.getByRole('button', { name: 'Foodcost' });
      log(name, 'foodcost-knop:', await fc.count());
      if (await fc.count()) { await fc.click(); await p.waitForTimeout(200); }
      log(name, 'chips:', (await p.locator('button[aria-label*="foodcost"], button[aria-label*="kostprijs"]').allInnerTexts()).join(' '));
      await shot(name);
      await p.locator('button[aria-label$=" openen"]').first().click();
      await p.waitForTimeout(500);
      log(name, 'banner:', await p.locator('a[href="/admin/bestellen?tab=allergens"]').allInnerTexts());
      log(name, 'sheet:', (await p.locator('[role="dialog"]').innerText()).slice(0, 260).replace(/\n/g, ' · '));
      log(name, 'allergeenstand:', (await p.locator('[role="dialog"] button[aria-expanded]').first().innerText()).replace(/\n/g, ' '));
      await shot(`${name}-sheet`);
    } else {
      if (extra === '&tab=allergens') log(name, 'todo:', (await p.locator('a[href^="/admin/products/"]').allInnerTexts()).join(' | '), '| standen:', (await p.locator('td span.rounded-full, td span.text-xs').allInnerTexts()).slice(0, 6).join(' / '));
      if (s === 'settings-accounting' || s === 'reports') log(name, 'tekst:', (await p.locator('#root').innerText()).slice(0, 220).replace(/\n/g, ' · '), '| links:', await p.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))));
      if (s !== 'sidebar' && s !== 'settings' && s !== 'settings-accounting' && s !== 'reports') log(name, 'tabs:', (await p.locator('[role="tab"][aria-selected="true"]').allInnerTexts()).join(' | '));
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) log(name, 'HORIZONTALE OVERLOOP', over);
      await shot(name);
    }
    await p.close();
  }
  if (errors.length) throw new Error('Fouten:\n' + errors.join('\n'));
}
