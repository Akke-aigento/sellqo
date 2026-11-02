// PRIJS-GATEN-1 harnas: warehouse ziet prijzen alleen-lezen (uitleg, slotje, geen invoer, niet meegestuurd),
// beheerder kan ze bewerken. Ook in het Engels; geen horizontale overloop.
async function overflow(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-part="variants"] *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.tagName).slice(0, 5));
}
async function editFirstVariant(page) {
  // De potloodknop van de eerste variant (mobiel: kaart, desktop: tabel) — de eerste zichtbare.
  const btn = page.locator('[data-part="variants"] button:has(svg.lucide-pencil):visible').last();
  await btn.click();
}
export async function run(page, { width, log, shot }) {
  const v = page.locator('[data-part="variants"]');
  const hint = 'Prijzen kun je met jouw rol niet wijzigen';
  if (!(await v.innerText()).includes(hint)) throw new Error('uitleg ontbreekt (warehouse, variant)');
  await editFirstVariant(page);
  const priceInputs = v.locator('input[type="number"][step="0.01"]:visible');
  const n = await priceInputs.count();
  const disabled = await priceInputs.evaluateAll((els) => els.filter((e) => e.disabled).length);
  log(`warehouse: ${n} prijsvelden, ${disabled} uitgeschakeld`);
  if (n !== 3 || disabled !== 3) throw new Error('prijsvelden variant niet uitgeschakeld');
  // Opslaan stuurt geen prijsvelden mee.
  await v.locator('button:has(svg.lucide-check):visible').first().click();
  const sent = await page.evaluate(() => JSON.stringify(window.__updates));
  log('verstuurd:', sent);
  if (/"price"|compare_at_price|cost_price/.test(sent)) throw new Error('prijsveld toch meegestuurd');
  await shot('variant-edit');
  const o = await overflow(page);
  log('overloop:', JSON.stringify(o));
  if (o.length) throw new Error('horizontale overloop varianten');
  if (width >= 1280) {
    const g = page.locator('[data-part="grid"]');
    if (!(await g.innerText()).includes('Velden met een slotje')) throw new Error('uitleg raster ontbreekt');
    const locks = await g.locator('svg.lucide-lock').count();
    log('slotjes in raster:', locks);
    if (locks < 4) throw new Error('prijs/sku-cellen niet op slot');
    // Klik op een prijscel: geen invoerveld.
    await g.locator('[title="Met jouw rol kun je dit veld niet wijzigen."]').first().click({ force: true });
    if (await g.locator('input').count()) throw new Error('vergrendelde cel werd bewerkbaar');
    // Naamcel blijft bewerkbaar.
    await g.getByText('Pizza Margherita').click();
    if (!(await g.locator('input').count())) throw new Error('naamcel niet meer bewerkbaar');
  }
  // Beheerder: geen uitleg, velden aan.
  const url = new URL(page.url()); url.searchParams.set('role', 'tenant_admin');
  await page.goto(url.toString()); await page.waitForLoadState('networkidle');
  if ((await v.innerText()).includes(hint)) throw new Error('uitleg ook bij beheerder');
  await editFirstVariant(page);
  const en = await v.locator('input[type="number"][step="0.01"]:visible').evaluateAll((els) => els.filter((e) => !e.disabled).length);
  log('beheerder: prijsvelden aan =', en);
  if (en !== 3) throw new Error('beheerder kan variantprijs niet bewerken');
  if (width >= 1280 && await page.locator('[data-part="grid"] svg.lucide-lock').count()) throw new Error('slotjes bij beheerder');
  await shot('admin');
  // Engels.
  const u2 = new URL(page.url()); u2.searchParams.set('role', 'warehouse'); u2.searchParams.set('lang', 'en');
  await page.goto(u2.toString()); await page.waitForLoadState('networkidle');
  const t = await v.innerText();
  if (!t.includes("You can't change prices with your role")) throw new Error('Engelse uitleg ontbreekt');
  await shot('en');
}
