// TAFEL-SAMEN-1 — Zaal: waarschuwing "Open sinds gisteren · Lijnen van vorige gasten open: 3" bij tafel 8, "Tafel
// vrijgeven" met bevestiging (schrijft table_group_release), geen waarschuwing bij tafel 2/5. Nu: tegel "Vorige
// gasten". QR aan tafel: gedeeld mandje + "Tafel vrij na". Zonder de databankfunctie: geen waarschuwing, geen fout.
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
export async function run(page, { shot, log }) {
  const go = async (q) => { await page.goto(`${page.url().split('?')[0]}?${q}`); await page.waitForTimeout(1200); };
  await go('screen=zaal');
  const all = page.getByTestId('live-prev-guests');
  if ((await all.count()) !== 2) throw new Error(`zaal: verwacht 2 waarschuwingen (tafel 8 + stille tafel 5), kreeg ${await all.count()}`);
  const idle = page.getByTestId('live-row-c5').getByTestId('live-prev-guests');
  const it = (await idle.innerText()).replace(/\n/g, ' · ');
  log('zaal stille tafel', it);
  if (!/Geen activiteit sinds 1 u 03, nog open/.test(it) || (await idle.getByRole('button', { name: 'Tafel vrijgeven' }).count()) !== 1) throw new Error(`zaal: signaal stille tafel ${it}`);
  const warn = page.getByTestId('live-row-c8').getByTestId('live-prev-guests');
  const wt = (await warn.innerText()).replace(/\n/g, ' · ');
  log('zaal waarschuwing', wt, 'overflow', await overflow(page));
  if (!/Open sinds gisteren · Lijnen van vorige gasten open: 3/.test(wt)) throw new Error(`zaal: tekst ${wt}`);
  if ((await overflow(page)) > 0) throw new Error('zaal: horizontale overloop');
  await shot('zaal');
  await warn.getByRole('button', { name: 'Tafel vrijgeven' }).click(); await page.waitForTimeout(300);
  await shot('zaal-vrijgeven-bevestigen');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Tafel vrijgeven' }).click(); await page.waitForTimeout(400);
  const rel = (await page.evaluate(() => window.__writes)).filter((x) => x.rpc === 'table_group_release');
  log('vrijgeven schrijft', JSON.stringify(rel));
  if (rel.length !== 1 || rel[0].args.p_table_id !== 'tb8') throw new Error('zaal: Tafel vrijgeven riep table_group_release niet (juist) aan');
  await shot('zaal-vrijgegeven');
  await go('screen=zaal&lang=en');
  log('zaal en', (await page.getByTestId('live-row-c8').getByTestId('live-prev-guests').innerText()).replace(/\n/g, ' · '));
  await shot('zaal-en');
  await go('screen=zaal&groups=off');
  if ((await page.getByTestId('live-prev-guests').count()) !== 0) throw new Error('zaal zonder functie: toch een waarschuwing');
  log('zaal zonder functie: rijen', await page.locator('[data-testid^="live-row-"]').count());
  await go('screen=nu');
  const tile = page.getByTestId('now-prev-guests');
  if ((await tile.count()) !== 1) throw new Error('nu: geen tegel Vorige gasten');
  log('nu tegel', (await tile.innerText()).replace(/\n/g, ' · '), 'overflow', await overflow(page));
  await shot('nu');
  await go('screen=qr');
  const shared = page.getByRole('switch', { name: 'Gedeeld tafelmandje' });
  if ((await shared.count()) !== 1) throw new Error('qr: geen schakelaar Gedeeld tafelmandje');
  log('qr idle', await page.locator('#qr-idle').inputValue(), 'overflow', await overflow(page));
  await page.locator('#qr-idle').selectOption('180');
  await shared.click();
  await page.getByRole('button', { name: 'Opslaan' }).click(); await page.waitForTimeout(400);
  const save = (await page.evaluate(() => window.__writes)).filter((x) => x.table === 'fulfillment_settings');
  log('qr bewaart', JSON.stringify(save.map((x) => ({ qr_shared_cart: x.v.qr_shared_cart, qr_group_idle_minutes: x.v.qr_group_idle_minutes }))));
  if (!save.some((x) => x.v.qr_shared_cart === false && x.v.qr_group_idle_minutes === 180)) throw new Error('qr: instellingen niet bewaard');
  await go('screen=qr');
  await page.locator('#qr-idle').scrollIntoViewIfNeeded();
  await shot('qr');
}
