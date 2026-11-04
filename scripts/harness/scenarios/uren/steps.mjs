// UREN-1 / WEBSITE-HORECA-1 — elk scherm op 390 en 1280 px, per scherm een vers tabblad (zoals horeca-beheer).
export const setup = {};
const screens = [
  ['sidebar', ''], ['sidebar', '&tracks=horeca,webshop'],
  ['bedrijf', ''], ['bedrijf', '&role=viewer'], ['bedrijf', '&hours=empty'],
  ['afhalen', ''], ['afhalen', '&hours=empty'], ['reservaties', ''],
  ['website', ''], ['website', '&tracks=webshop'], ['aanpassen', ''], ['hub', ''],
];
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const [s, extra] of screens) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${s}${extra}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|sellqo\.shop/.test(m.text())) errors.push(`[${width} ${s}${extra}] ${m.text()}`); });
    const name = `${s}${extra.replace(/[&=,]/g, '_')}`;
    const shot = (n) => p.screenshot({ path: `/tmp/harness/uren-${width}-${n}.png`, fullPage: true });
    await p.goto(`${base}?screen=${s}${extra}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(700);
    const text = async () => (await p.locator('#root').innerText()).replace(/\n/g, ' · ');
    if (s === 'sidebar') {
      if (width < 768) { await p.getByRole('button', { name: 'menu' }).click(); await p.waitForTimeout(400); }
      log(name, (await p.locator('[data-sidebar="content"]').last().innerText()).replace(/\n/g, ' · '));
    } else if (s === 'bedrijf') {
      const card = p.locator('#openingsuren');
      log(name, 'kaart:', (await card.innerText()).slice(0, 420).replace(/\n/g, ' · '));
      log(name, 'opslaan-knop:', await card.getByRole('button', { name: 'Openingsuren opslaan' }).count(), '| schakelaars uit:', await card.locator('button[role="switch"][disabled]').count());
      if (!extra) {
        // Klikpad: zondag open zetten → "Niet-bewaarde wijzigingen"; sluiting toevoegen; bewaren schrijft business_hours.
        await card.getByRole('switch', { name: /zondag/i }).click();
        await card.getByLabel('Van', { exact: true }).last().fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
        await card.getByLabel('Reden (optioneel)').fill('Opendeurdag');
        await card.getByRole('button', { name: 'Toevoegen', exact: true }).click();
        log(name, 'na klikken:', (await card.innerText()).includes('Niet-bewaarde wijzigingen') ? 'onbewaard' : 'GEEN onbewaard-melding', '| chips:', (await card.locator('li.rounded-full').allInnerTexts()).join(' / '));
        await card.getByRole('button', { name: 'Openingsuren opslaan' }).click();
        await p.waitForTimeout(400);
        const writes = await p.evaluate(() => window.__writes);
        log(name, 'geschreven:', JSON.stringify(writes).slice(0, 300));
      }
    } else if (s === 'afhalen' || s === 'reservaties') {
      log(name, 'keuzes:', (await p.locator('button[role="radio"]').evaluateAll((b) => b.map((x) => `${x.id}=${x.getAttribute('aria-checked')}`))).join(' '));
      log(name, 'tekst:', (await text()).match(/(Zelfde als openingsuren.{0,220})/)?.[1] ?? '—');
      log(name, 'links:', (await p.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).join(' '));
      if (s === 'afhalen' && !extra) {
        await p.getByRole('button', { name: 'Uren levering' }).click();
        await p.waitForTimeout(200);
        log(name, 'levering-tab keuzes:', (await p.locator('button[role="radio"]').evaluateAll((b) => b.map((x) => `${x.id}=${x.getAttribute('aria-checked')}`))).join(' '), '|', (await text()).match(/(Zelfde als openingsuren.{0,160})/)?.[1] ?? '—');
        await shot(`${name}-levering`);
        await p.getByRole('button', { name: 'Uren afhalen' }).click();
      }
    } else if (s === 'website') {
      log(name, 'kop:', await p.locator('h1').innerText(), '|', (await text()).slice(0, 260));
    } else if (s === 'aanpassen') {
      await p.getByRole('button', { name: 'Sectie toevoegen' }).click();
      await p.waitForTimeout(300);
      log(name, 'toe te voegen:', (await p.locator('[data-radix-popper-content-wrapper] button span.block.text-sm').allInnerTexts()).join(' | '));
    } else {
      log(name, (await text()).slice(0, 400));
    }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) log(name, 'HORIZONTALE OVERLOOP', over);
    await shot(name);
    await p.close();
  }
  if (errors.length) throw new Error('Fouten:\n' + errors.join('\n'));
}
