// ZIJBALK-BESTELLINGEN-1 — per variant een vers tabblad; logt de zijbalk en de onderbalk en controleert of
// Bestellingen er (niet) staat. Gooit bij een afwijking of een console-fout (exit 1).
export const setup = {};
const variants = [
  ['online-aan', 'online=on&tracks=horeca', true],
  ['online-uit', 'online=off&tracks=horeca', false],
  ['uit-met-orders', 'online=orders&tracks=horeca', true],
  ['combi-uit', 'online=off&tracks=horeca,webshop', true],
];
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const [name, qs, expectOrders] of variants) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${name}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${name}] ${m.text()}`); });
    await p.goto(`${base}?${qs}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(600);
    let bottom = '';
    if (width < 768) {
      bottom = (await p.locator('nav').last().innerText()).replace(/\n/g, ' · ');
      await p.getByRole('button', { name: 'menu' }).click();
      await p.waitForTimeout(400);
    }
    const side = (await p.locator('[data-sidebar="content"]').last().innerText()).replace(/\n/g, ' · ');
    const queries = await p.evaluate(() => window.__queries ?? []);
    log(name, 'zijbalk:', side);
    if (bottom) log(name, 'onderbalk:', bottom);
    log(name, 'queries:', queries.join(', '));
    const has = side.split(' · ').includes('Bestellingen');
    if (has !== expectOrders) errors.push(`[${width} ${name}] Bestellingen ${has ? 'staat er' : 'ontbreekt'}, verwacht ${expectOrders ? 'wel' : 'niet'}`);
    await p.screenshot({ path: `/tmp/harness/zijbalk-bestellingen-${width}-${name}.png`, fullPage: true });
    await p.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
