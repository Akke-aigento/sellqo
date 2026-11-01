// KASSA-ODOO-1 harnas: uit → aan met een datum in het verleden → bevestigingsdialoog (met aantal);
// aan-kaart: needs_review-rij met Aanvaarden/Opnieuw proberen → aanvaard-dialoog.
export const setup = {
  count: 3,
  log: [
    { id: 'l1', report_no: 41, booking_date: '2026-10-29', sync_status: 'needs_review', odoo_move_name: 'Z-2026-00041', error_message: 'ODOO_MISMATCH: 21%: btw 135.37 ≠ 135.00 (boeking Z-2026-00041, Odoo-id 812, concept, niet geboekt)', created_at: '2026-10-30T07:47:00Z' },
    { id: 'l2', report_no: 42, booking_date: '2026-10-30', sync_status: 'failed', odoo_move_name: 'Z-2026-00042', error_message: 'Prijs-inclusieve btw-code "6% incl." ontbreekt in Odoo (verkoop, "Inbegrepen in prijs").', created_at: '2026-10-31T07:47:00Z' },
    { id: 'l3', report_no: 43, booking_date: '2026-10-31', sync_status: 'synced', odoo_move_name: 'Z-2026-00043', error_message: null, created_at: '2026-11-01T07:47:00Z' },
    { id: 'l4', report_no: 44, booking_date: '2026-11-01', sync_status: 'accepted', odoo_move_name: 'Z-2026-00044', error_message: null, created_at: '2026-11-01T08:47:00Z' },
  ],
};

/** Breder dan het scherm = iets schuift. */
async function overflow(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-harness="root"] *')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`).slice(0, 5));
}

export async function run(page, { width, shot, log }) {
  log('overloop start:', JSON.stringify(await overflow(page)));
  const off = page.locator('[data-card="off"]');
  await off.getByRole('switch').click();
  const today = await off.locator('#pos-z-from').inputValue();
  log('startdatum na aanzetten:', today);
  await off.locator('#pos-z-from').fill('2026-10-01');
  await shot('aan-verleden');
  await off.getByRole('button', { name: 'Opslaan', exact: true }).click();
  await page.getByRole('alertdialog').waitFor();
  log('dialoog:', (await page.getByRole('alertdialog').innerText()).replace(/\n/g, ' · '));
  await shot('bevestiging');
  await page.getByRole('button', { name: 'Ja, 3 Z-rapporten boeken' }).click();
  await page.waitForTimeout(300);
  log('rpc:', JSON.stringify(await page.evaluate(() => window.__rpc?.map((r) => r.name))), 'opgeslagen:', JSON.stringify(await page.evaluate(() => window.__saved)));

  const on = page.locator('[data-card="on"]');
  await on.scrollIntoViewIfNeeded();
  log('knoppen aan-kaart:', JSON.stringify(await on.getByRole('button').allInnerTexts()));
  await shot('log');
  await on.getByRole('button', { name: 'Aanvaarden' }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.locator('#pos-z-accept-note').fill('Met de hand geboekt als VK/2026/0812');
  log('overloop dialoog:', JSON.stringify(await overflow(page)));
  await shot('aanvaarden');
  await page.getByRole('dialog').getByRole('button', { name: 'Aanvaarden' }).click();
  await page.waitForTimeout(300);
  log('rpc na aanvaarden:', JSON.stringify(await page.evaluate(() => window.__rpc?.map((r) => r.name))));
}
