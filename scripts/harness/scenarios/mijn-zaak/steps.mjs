// HORECA-INSTELLINGEN-1 — elk scherm op 390 en 1280 px, per scherm een vers tabblad (zie horeca-beheer).
export const setup = {};
const enc = (p) => `&path=${encodeURIComponent(p)}`;
const screens = [
  ['sidebar', ''],
  ['sidebar', '&tracks=webshop'],
  ['settings', ''],
  ...['zaak', 'gasten', 'betalen', 'zaal-keuken', 'toestellen', 'geld', 'jij'].map((g) => ['settings', enc(`/admin/settings?section=${g}`), `groep-${g}`]),
  ['settings', enc('/admin/settings?section=betalen&tab=fooi'), 'betalen-fooi'],
  ['settings', enc('/admin/settings?section=company#openingsuren'), 'oud-company-uren'],
  ['settings', enc('/admin/settings?section=payments'), 'oud-payments'],
  ['settings', '&role=staff', 'staff-overzicht'],
  // 1b: enkel de zaakvoerder ziet de checklist en de groepen van de zaak; viewer ziet Je zaak (lezen) en Jij.
  ['settings', '&role=viewer', 'viewer-overzicht'],
  ['settings', '&role=staff' + enc('/admin/settings?section=betalen'), 'staff-betalen-diep'],
  ['settings', enc('/admin/settings?section=domain'), 'oud-domain'],
  ['settings', enc('/admin/settings?section=geld&tab=btw'), 'geld-btw'],
  // 1b: combinatiezaak met een verouderde cache die "horeca-only" zegt: blijft op Betalingen (klassiek).
  ['settings', '&tracks=horeca,webshop&cache=horeca' + enc('/admin/settings?section=payments'), 'combi-cache-payments'],
  ['sidebar', '&tracks=horeca,webshop', 'combi-zijbalk'],
  ['staff', '&tracks=horeca,webshop', 'combi-personeel'],
  ['staff', '&tracks=horeca,webshop' + enc('/admin/personeel?tab=beheerders'), 'combi-personeel-beheerders'],
  ['reservations', '&tracks=horeca,webshop', 'combi-reservaties'],
  ['settings', '&tracks=webshop', 'webshop-instellingen'],
  ['staff', ''],
  ['staff', enc('/admin/personeel?tab=uren'), 'personeel-uren'],
  ['reservations', ''],
  ['search', ''],
  ['header', ''],
];
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const [s, extra, label] of screens) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    const name = label ?? `${s}${extra.replace(/[&=,]/g, '_')}`;
    p.on('pageerror', (e) => errors.push(`[${width} ${name}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${name}] ${m.text()}`); });
    const shot = (n) => p.screenshot({ path: `/tmp/harness/mijn-zaak-${width}-${n}.png`, fullPage: true });
    const screen = s === 'search' ? 'settings' : s;
    await p.goto(`${base}?screen=${screen}${extra}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(700);
    const where = async () => (await p.locator('[data-testid="where"]').allInnerTexts()).join(' ');
    if (s === 'sidebar') {
      if (width < 768) { await p.getByRole('button', { name: 'menu' }).click(); await p.waitForTimeout(400); }
      // Rapporten openklappen: Transacties staat er als kind onder (horeca-only).
      const rep = p.locator('[data-sidebar="menu-action"][aria-label="Rapporten"]');
      if (await rep.count()) { await rep.first().click(); await p.waitForTimeout(300); }
      log(name, (await p.locator('[data-sidebar="content"]').last().innerText()).replace(/\n/g, ' · '));
    } else if (s === 'search') {
      await p.getByRole('combobox').first().fill('fooi');
      await p.waitForTimeout(300);
      log(name, 'resultaten:', (await p.locator('[cmdk-item]').allInnerTexts()).map((x) => x.replace(/\n/g, ' › ')).join(' | '));
    } else if (s === 'header') {
      await p.keyboard.press('Control+k');
      await p.waitForTimeout(400);
      await p.getByRole('dialog').getByRole('combobox').fill('printer');
      await p.waitForTimeout(300);
      log(name, 'dialoog:', (await p.locator('[role="dialog"] [cmdk-item]').allInnerTexts()).map((x) => x.replace(/\n/g, ' › ')).join(' | '));
      await shot(name);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(300);
      log(name, 'na Enter:', await where());
      await p.close();
      continue;
    } else {
      log(name, 'route:', await where());
      log(name, 'tabs:', (await p.locator('[role="tab"]').allInnerTexts()).join(' | '), '| actief:', (await p.locator('[role="tab"][aria-selected="true"]').allInnerTexts()).join(''));
      if (['settings', 'staff-overzicht', 'viewer-overzicht', 'staff-betalen-diep'].includes(name)) {
        const owner = (await p.locator('[data-testid="owner-note"]').allInnerTexts()).join('');
        const groupsSeen = (await p.locator('ul.grid li').allInnerTexts()).map((x) => x.replace(/\n/g, ': ')).join(' | ');
        log(name, 'checklist-stappen:', await p.locator('[data-step]').count(), '| uitleg:', owner || '-', '| groepen:', groupsSeen);
        if (name !== 'settings' && ((await p.locator('[data-step]').count()) > 0 || !owner)) errors.push(`[${width} ${name}] niet-beheerder ziet checklist of geen uitleg`);
        if (name !== 'settings' && /Je gasten|Betalen|Zaal & keuken|Kassa’s & toestellen/.test(groupsSeen)) errors.push(`[${width} ${name}] niet-beheerder ziet een groep van de zaakvoerder`);
      }
      const expect = {
        'combi-cache-payments': '/admin/settings?section=payments',
        'combi-personeel': '/admin/pos?tab=personeel',
        'combi-personeel-beheerders': '/admin/settings?section=team',
        'combi-reservaties': '/admin/bestellen?tab=reservaties',
        'oud-domain': '/admin/settings?section=zaak&tab=website',
      }[name];
      if (expect && (await where()) !== expect) errors.push(`[${width} ${name}] route ${await where()} ≠ ${expect}`);
      if (name === 'oud-domain') log(name, 'domeinregel:', (await p.getByText('Een eigen domeinnaam komt binnenkort.').count()));
      if (name === 'settings') log(name, 'checklist:', (await p.locator('[data-step]').evaluateAll((li) => li.map((x) => `${x.getAttribute('data-step')}=${x.getAttribute('data-done')}`))).join(' '));
      log(name, 'kop:', (await p.locator('h1, h2').allInnerTexts()).slice(0, 4).join(' | '));
    }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) { log(name, 'HORIZONTALE OVERLOOP', over); errors.push(`[${width} ${name}] horizontale overloop ${over}px`); }
    await shot(name);
    await p.close();
  }
  if (errors.length) throw new Error('Fouten:\n' + errors.join('\n'));
}
