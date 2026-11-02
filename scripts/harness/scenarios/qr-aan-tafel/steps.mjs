// QR-MODULES-1 — elke variant op 390 en 1280 px (vers tabblad per variant), plus één klikscenario:
// "Ober roepen" aanzetten en bewaren schrijft enkel fulfillment_settings met qr_call_waiter.
export const setup = {};
const variants = ['check', 'order', 'check-nostripe', 'fiscal', 'view', 'kassa', 'oldapi', 'check&lang=en'];
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const v of variants) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${v}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${v}] ${m.text()}`); });
    const name = v.replace(/[&=]/g, '_');
    const lang = v.includes('lang=en') ? '&lang=en' : '';
    await p.goto(`${base}?v=${v.split('&')[0]}${lang}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(500);
    const switches = await p.locator('button[role="switch"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}=${e.getAttribute('data-state')}${e.hasAttribute('disabled') ? '(grijs)' : ''}`));
    log(name, 'schakelaars:', switches.join(' | '));
    log(name, 'links:', (await p.locator('a').evaluateAll((as) => as.map((a) => `${a.textContent}→${a.getAttribute('href')}`))).join(' | '));
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) log(name, 'HORIZONTALE OVERLOOP', over);
    await p.screenshot({ path: `/tmp/harness/qr-aan-tafel-${width}-${name}.png`, fullPage: true });
    if (v === 'check') {
      await p.locator('button[role="switch"][aria-label="Ober roepen"]').click();
      await p.getByRole('button', { name: 'Opslaan' }).click();
      await p.waitForTimeout(400);
      const ups = await p.evaluate(() => window.__upserts);
      log(name, 'upserts:', JSON.stringify(ups));
      if (ups.length !== 1 || ups[0].table !== 'fulfillment_settings' || ups[0].row.qr_call_waiter !== true || ups[0].row.qr_call_bill !== true) errors.push(`[${width}] verkeerde upsert: ${JSON.stringify(ups)}`);
    }
    if (v === 'kassa') {
      await p.getByText('Contant').first().click();
      await p.getByRole('button', { name: 'Opslaan' }).click();
      await p.waitForTimeout(400);
      const ups = await p.evaluate(() => window.__upserts);
      log(name, 'upserts:', JSON.stringify(ups));
      if (ups.length !== 1 || ups[0].table !== 'horeca_pay_settings' || 'online_pay' in ups[0].row) errors.push(`[${width}] kassa schrijft gast-kolommen: ${JSON.stringify(ups)}`);
    }
    await p.close();
  }
  if (errors.length) throw new Error('Fouten:\n' + errors.join('\n'));
}
