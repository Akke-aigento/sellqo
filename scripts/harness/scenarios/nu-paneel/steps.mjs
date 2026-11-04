// HORECA-NU-1/2 — Nu-paneel (beheer) rustig/druk, als beheerder, medewerker en marketing; de lijsten
// Uitverkocht en Dagschotel, de bevestiging "vandaag dicht"; en ⋯ › Nu op de kassa als eigenaar en als ober.
// Meet horizontale overloop en de zichtbare tegels per rol.
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const tiles = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid^="now-"],[data-testid^="kassa-now-"]')].map((e) => e.getAttribute('data-testid')).filter((x) => !/list|current|approval|panel|special-list/.test(x)));
export async function run(page, { width, shot, log }) {
  const go = async (q) => { await page.goto(`${page.url().split('?')[0]}?${q}`); await page.waitForTimeout(900); };
  await go('screen=beheer&v=rustig');
  log('beheer rustig tegels', JSON.stringify(await tiles(page)), 'overflow', await overflow(page));
  if ((await page.getByTestId('now-closed-banner').count()) !== 0) throw new Error('nu-paneel: dicht-status terwijl de zaak open is');
  await shot('beheer-rustig');
  await page.getByTestId('now-soldout').click(); await page.waitForTimeout(400);
  await shot('beheer-uitverkocht');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.getByTestId('now-special').click(); await page.waitForTimeout(400);
  // HORECA-NU-1b: de keuzelijst toont enkel wat op het menu of aan tafel staat (niet p9 kassa-only, niet p10 verborgen).
  log('dagschotel keuzelijst', JSON.stringify(await page.getByTestId('now-special-list').locator('li span.font-semibold').allTextContents()));
  await page.getByRole('button', { name: 'Nieuw gerecht als dagschotel' }).click(); await page.waitForTimeout(200);
  await shot('beheer-dagschotel');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.getByTestId('now-closed').click(); await page.waitForTimeout(300);
  await shot('beheer-vandaag-dicht-bevestigen');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.getByTestId('now-pause').click(); await page.waitForTimeout(300);
  await shot('beheer-pauze-menu');
  await page.keyboard.press('Escape');
  await page.getByTestId('now-zone-a2').click(); await page.waitForTimeout(300);
  log('schrijfacties na tik op Terras', JSON.stringify(await page.evaluate(() => window.__writes)));
  await go('screen=beheer&v=druk');
  log('beheer druk tegels', JSON.stringify(await tiles(page)), 'overflow', await overflow(page));
  // HORECA-STAAT-1 — de tegels zeggen wat er echt gebeurt, en "vandaag dicht" staat duidelijk bovenaan.
  const pauseSub = (await page.getByTestId('now-pause').innerText()).replace(/\n/g, ' · ');
  log('pauzetegel', pauseSub);
  if (!/Online en keukengerechten aan tafel staan stil tot \d\d:\d\d · tik om te hervatten/.test(pauseSub)) throw new Error(`nu-paneel: pauzetegel zegt niet wat er stilligt: ${pauseSub}`);
  const banner = page.getByTestId('now-closed-banner');
  if ((await banner.count()) !== 1) throw new Error('nu-paneel: geen status "vandaag dicht" bovenaan');
  log('vandaag-dicht-status', (await banner.innerText()).replace(/\n/g, ' · '));
  if ((await overflow(page)) > 0) throw new Error('nu-paneel: horizontale overloop met de dicht-status');
  // Pauzestatus enkel als de zaak niet dicht is (één melding tegelijk); hier is ze dicht.
  if ((await page.getByTestId('now-pause-banner').count()) !== 0) throw new Error('nu-paneel: twee meldingen tegelijk');
  await banner.getByRole('button', { name: 'Toch open vandaag' }).click(); await page.waitForTimeout(300);
  const reopen = (await page.evaluate(() => window.__writes)).filter((x) => x.rpc || x.table === 'business_hours');
  log('schrijfactie na "Toch open vandaag"', JSON.stringify(reopen));
  if (!reopen.length) throw new Error('nu-paneel: "Toch open vandaag" schreef niets');
  await shot('beheer-druk');
  await go('screen=beheer&v=pauze');
  const pb = page.getByTestId('now-pause-banner');
  if ((await pb.count()) !== 1) throw new Error('nu-paneel: geen pauzestatus bovenaan');
  const pbt = (await pb.innerText()).split(/\n+/).map((x) => x.trim()).filter(Boolean).join(' · ');
  log('pauzestatus', pbt);
  if (!/^Online en keukengerechten aan tafel staan stil tot \d\d:\d\d · Hervatten$/.test(pbt)) throw new Error(`nu-paneel: pauzestatus: ${pbt}`);
  await shot('beheer-pauze-status');
  await pb.getByRole('button', { name: 'Hervatten' }).click(); await page.waitForTimeout(300);
  const resume = (await page.evaluate(() => window.__writes)).filter((x) => x.table === 'fulfillment_settings');
  log('schrijfactie na Hervatten', JSON.stringify(resume));
  if (!resume.some((x) => x.v && x.v.paused_until === null)) throw new Error('nu-paneel: Hervatten zette paused_until niet op null');
  await go('screen=beheer&v=druk&role=staff');
  log('medewerker tegels', JSON.stringify(await tiles(page)));
  await shot('beheer-medewerker');
  await go('screen=beheer&v=rustig&role=marketing');
  log('marketing tegels', JSON.stringify(await tiles(page)));
  await go('screen=beheer&v=druk&lang=en');
  await shot('beheer-druk-en');
  await go('screen=kassa&v=druk&role=owner');
  log('kassa eigenaar tegels', JSON.stringify(await tiles(page)), 'overflow', await overflow(page));
  await shot('kassa-eigenaar');
  await page.getByTestId('kassa-now-special').click(); await page.waitForTimeout(300);
  await shot('kassa-dagschotel');
  await page.getByTestId('kassa-now-zone-a2').click(); await page.waitForTimeout(400);
  log('kassa schrijfactie', JSON.stringify((await page.evaluate(() => window.__writes)).filter((x) => x.fn === 'kassa_now_apply')));
  await go('screen=kassa&v=rustig&role=waiter');
  log('kassa ober: akkoordblok', await page.getByTestId('kassa-now-approval').count(), 'overflow', await overflow(page));
  await shot('kassa-ober');
  // HORECA-NU-1b: Vergrendelen verschijnt zodra er een PIN staat en wist hem meteen.
  log('kassa ober: vergrendelen vóór PIN', await page.getByTestId('kassa-now-lock').count());
  await page.getByTestId('kassa-now-approval').locator('input[type=password]').fill('1234'); await page.waitForTimeout(200);
  log('kassa ober: vergrendelen na PIN', await page.getByTestId('kassa-now-lock').count());
  await shot('kassa-ober-pin');
  await page.getByTestId('kassa-now-lock').click(); await page.waitForTimeout(200);
  log('kassa ober: PIN na vergrendelen', JSON.stringify(await page.getByTestId('kassa-now-approval').locator('input[type=password]').inputValue()), 'knop', await page.getByTestId('kassa-now-lock').count());
}
