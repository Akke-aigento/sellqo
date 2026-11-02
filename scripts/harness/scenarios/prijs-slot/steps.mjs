// PRIJS-GATEN-1 harnas.
// - marketing (mag producten bewerken, geen prijzen): variantprijzen uitgeschakeld met uitleg, niet meegestuurd;
//   raster met slotjes.
// - warehouse (alleen-lezen productpagina, wel voorraad): geen knoppen voor opties, genereren, bewerken,
//   foto's, verwijderen of koppelen; wel +/− voorraad; uitleg.
// - viewer: idem zonder +/− voorraad.
// - beheerder: alles aan, geen uitleg, geen slotjes.
// Ook in het Engels; geen horizontale overloop.
async function overflow(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-harness="root"] [data-part="variants"] *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.tagName).slice(0, 5));
}
const V = '[data-part="variants"]';
async function count(page, sel) { return page.locator(`${V} ${sel}`).count(); }
async function visibleCount(page, sel) { return page.locator(`${V} ${sel}:visible`).count(); }
async function goRole(page, role, extra = {}) {
  const url = new URL(page.url()); url.searchParams.set('role', role);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  await page.goto(url.toString()); await page.waitForLoadState('networkidle');
}
// Knoppen die zonder schrijfrecht niet mogen bestaan.
const WRITE_ONLY = ['button:has(svg.lucide-pencil)', 'button:has(svg.lucide-trash2)', 'button:has(svg.lucide-wand-sparkles), button:has(svg.lucide-wand2)',
  'button:has(svg.lucide-link2)', 'button:has(svg.lucide-image-plus)'];

export async function run(page, { width, log, shot }) {
  const v = page.locator(V);
  // --- marketing -----------------------------------------------------------------------------------
  if (!(await v.innerText()).includes('Prijzen kun je met jouw rol niet wijzigen')) throw new Error('prijsuitleg ontbreekt (marketing)');
  await page.locator(`${V} button:has(svg.lucide-pencil):visible`).last().click();
  const priceInputs = v.locator('input[type="number"][step="0.01"]:visible');
  const n = await priceInputs.count();
  const disabled = await priceInputs.evaluateAll((els) => els.filter((e) => e.disabled).length);
  log(`marketing: ${n} prijsvelden, ${disabled} uitgeschakeld`);
  if (n !== 3 || disabled !== 3) throw new Error('prijsvelden variant niet uitgeschakeld');
  await v.locator('button:has(svg.lucide-check):visible').first().click();
  const sent = await page.evaluate(() => JSON.stringify(window.__updates));
  log('verstuurd:', sent);
  if (/"price"|compare_at_price|cost_price/.test(sent)) throw new Error('prijsveld toch meegestuurd');
  await shot('marketing');
  if (width >= 1280) {
    const g = page.locator('[data-part="grid"]');
    if (!(await g.innerText()).includes('Velden met een slotje')) throw new Error('uitleg raster ontbreekt');
    const locks = await g.locator('svg.lucide-lock').count();
    log('slotjes in raster:', locks);
    if (locks < 4) throw new Error('prijs/sku-cellen niet op slot');
    await g.locator('[title="Met jouw rol kun je dit veld niet wijzigen."]').first().click({ force: true });
    if (await g.locator('input').count()) throw new Error('vergrendelde cel werd bewerkbaar');
    await g.getByText('Pizza Margherita').click();
    if (!(await g.locator('input').count())) throw new Error('naamcel niet meer bewerkbaar');
  }
  // --- warehouse en viewer: alleen-lezen ---------------------------------------------------------
  for (const [role, stock, hint] of [['warehouse', true, 'en de voorraad bijwerken'], ['viewer', false, 'Je kunt de varianten bekijken; aanpassen']]) {
    await goRole(page, role);
    const txt = await v.innerText();
    if (!txt.includes(hint)) throw new Error(`alleen-lezen-uitleg ontbreekt (${role})`);
    if (txt.includes('Optienaam') || txt.includes('Varianten genereren') || txt.includes('Koppelen')) throw new Error(`schrijfknoppen zichtbaar (${role})`);
    for (const sel of WRITE_ONLY) {
      const c = await count(page, sel);
      if (c) throw new Error(`${role}: ${c}× ${sel}`);
    }
    const steppers = await visibleCount(page, 'button:has(svg.lucide-plus)');
    log(`${role}: +voorraad-knoppen ${steppers}`);
    if (stock ? steppers < 2 : steppers !== 0) throw new Error(`voorraad-knoppen fout (${role})`);
    const o = await overflow(page);
    if (o.length) throw new Error(`horizontale overloop (${role}): ${JSON.stringify(o)}`);
    if (width >= 1280) {
      // PRIJS-GATEN-2: raster alleen-lezen; enkel voorraad (Tiramisu, zonder varianten) voor warehouse.
      const g = page.locator('[data-part="grid"]');
      const gt = await g.innerText();
      if (!gt.includes(stock ? 'Je kunt de producten bekijken en de voorraad bijwerken' : 'Je kunt de producten bekijken; aanpassen')) throw new Error(`uitleg raster ontbreekt (${role})`);
      await g.getByText('Tiramisu').click({ force: true });
      if (await g.locator('input').count()) throw new Error(`naamcel bewerkbaar (${role})`);
      const toggles = await g.locator('button[role="switch"]').evaluateAll((els) => els.filter((e) => !e.closest('.pointer-events-none')).length);
      if (toggles) throw new Error(`schakelaars klikbaar (${role}): ${toggles}`);
      const stockCell = g.locator('div.font-mono', { hasText: /^4$/ }).first();
      await stockCell.click({ force: true });
      const inputs = await g.locator('input').count();
      log(`${role}: voorraadcel bewerkbaar = ${inputs > 0}`);
      if (stock !== inputs > 0) throw new Error(`voorraadcel fout (${role})`);
      await page.keyboard.press('Escape');
    }
    await shot(role);
  }
  // --- bulkbewerking: marketing ziet geen tabs Prijzen/Voorraad en geen btw; beheerder wel ---------------
  for (const [role, full] of [['marketing', false], ['tenant_admin', true]]) {
    await goRole(page, role, { screen: 'bulk' });
    const tabs = await page.locator('[role="tab"]').allInnerTexts();
    log(`bulk ${role}: ${tabs.join(' | ')}`);
    const hasPrices = tabs.some((x) => x.includes('Prijzen')); const hasStock = tabs.some((x) => x.includes('Voorraad'));
    if (hasPrices !== full || hasStock !== full) throw new Error(`bulk-tabs fout (${role})`);
    const vat = await page.locator('#enable-vat').count();
    if ((vat > 0) !== full) throw new Error(`btw in bulk fout (${role})`);
    await shot(`bulk-${role}`);
  }
  await goRole(page, 'marketing', { screen: '' });
  // --- beheerder ---------------------------------------------------------------------------------
  await goRole(page, 'tenant_admin');
  const at = await v.innerText();
  if (at.includes('niet wijzigen') || at.includes('bekijken')) throw new Error('uitleg ook bij beheerder');
  if (!at.includes('Varianten genereren') || !(await visibleCount(page, 'button:has(svg.lucide-trash2)'))) throw new Error('beheerder mist knoppen');
  await page.locator(`${V} button:has(svg.lucide-pencil):visible`).last().click();
  const en = await v.locator('input[type="number"][step="0.01"]:visible').evaluateAll((els) => els.filter((e) => !e.disabled).length);
  log('beheerder: prijsvelden aan =', en);
  if (en !== 3) throw new Error('beheerder kan variantprijs niet bewerken');
  if (width >= 1280 && await page.locator('[data-part="grid"] svg.lucide-lock').count()) throw new Error('slotjes bij beheerder');
  await shot('admin');
  // --- Engels ------------------------------------------------------------------------------------
  await goRole(page, 'marketing', { lang: 'en' });
  if (!(await v.innerText()).includes("You can't change prices with your role")) throw new Error('Engelse prijsuitleg ontbreekt');
  await goRole(page, 'warehouse', { lang: 'en' });
  if (!(await v.innerText()).includes('You can view the variants and update stock')) throw new Error('Engelse alleen-lezen-uitleg ontbreekt');
  await shot('en');
}
