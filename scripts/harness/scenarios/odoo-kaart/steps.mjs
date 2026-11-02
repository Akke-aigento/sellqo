// ODOO-HORECA-1 harnas: de upgradetekst volgt het spoor; geen overloop; ook in het Engels.
async function overflow(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-harness="root"] *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.tagName).slice(0, 5));
}
export async function run(page, { log, shot }) {
  const text = async (k) => (await page.locator(`[data-card="${k}"]`).innerText()).replace(/\n/g, ' · ');
  const h = await text('horeca-locked');
  const w = await text('webshop-locked');
  log('horeca:', h);
  log('webshop:', w);
  if (!h.includes('Beschikbaar op Horeca Big') || h.includes('Pro')) throw new Error('horecakaart toont niet Horeca Big');
  if (!w.includes('Beschikbaar op Pro of Enterprise')) throw new Error('webshopkaart toont niet Pro/Enterprise');
  log('verbonden:', await text('connected'));
  const o = await overflow(page);
  log('overloop:', JSON.stringify(o));
  if (o.length) throw new Error('horizontale overloop');
  const url = new URL(page.url()); url.searchParams.set('lang', 'en');
  await page.goto(url.toString());
  await page.waitForLoadState('networkidle');
  const he = await text('horeca-locked');
  log('horeca (en):', he);
  if (!he.includes('Available on Hospitality Big')) throw new Error('Engelse horecatekst ontbreekt');
  await shot('en');
}
