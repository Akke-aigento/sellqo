// MENUKAART-PRINT-1: de knop Afdrukken op de Kaart, de dialoog per sjabloon, en echt een PDF maken
// in de browser (downloads naar /tmp/harness/menukaart-<breedte>-<sjabloon>.pdf).
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
export async function run(page, { width, shot, log }) {
  await page.getByRole('button', { name: 'Afdrukken' }).waitFor();
  log('kaart overflow', await overflow(page));
  await page.getByRole('button', { name: 'Afdrukken' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByText('60 gerechten', { exact: false }).waitFor();
  await page.waitForTimeout(300);
  await shot('dialoog-boekje');
  const grab = async (name) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'PDF downloaden' }).click()]);
    const file = `/tmp/harness/menukaart-${width}-${name}.pdf`;
    await dl.saveAs(file);
    log('download', name, dl.suggestedFilename());
    await page.waitForTimeout(400);
  };
  await grab('boekje');
  await page.getByRole('radio', { name: /A4-kaart/ }).click();
  await page.waitForTimeout(200);
  await shot('dialoog-a4');
  await page.getByRole('radio', { name: /Fotokaft/ }).click();
  await page.getByRole('button', { name: 'Deze foto op de kaft' }).first().click();
  await page.getByLabel('Ondertitel op de kaft (mag leeg)').fill('Keuken van het huis sinds 1998');
  await page.getByLabel('Ondertitel op de kaft (mag leeg)').blur();
  await page.waitForTimeout(300);
  await shot('dialoog-fotokaft');
  await grab('fotokaft');
  log('bewaard', JSON.stringify(await page.evaluate(() => window.__writes.map((x) => ({ t: x.row.template, cover: String(x.row.cover_image_url).slice(0, 22), sub: x.row.options.subtitle })))));
}
