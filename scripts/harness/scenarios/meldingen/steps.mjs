// HORECA-STAAT-1 — toasts wegswipen en sluiten. Faalt (gooit) bij een fout, zodat shoot.mjs exit 1 geeft.
export const setup = { tracks: ['horeca'] };
const toasts = (page) => page.locator('[data-sonner-toast]:not([data-removed="true"])');
// Vegen met de muis (desktop) of met een vinger (gsm: CDP-touch, zoals een duim op het scherm).
async function swipe(page, dx, dy, how = 'mouse') {
  const t = toasts(page).first();
  await t.waitFor();
  await page.waitForTimeout(450); // binnenkom-animatie
  const b = await t.boundingBox();
  const x = b.x + b.width / 2; const y = b.y + b.height / 2;
  if (how === 'touch') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8); await page.waitForTimeout(16); }
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
}
const expect = (cond, msg) => { if (!cond) throw new Error(`meldingen: ${msg}`); };
export async function run(page, { width, shot, log }) {
  const count = () => toasts(page).count();
  let checks = 0;
  const check = async (name, cond) => { checks++; expect(cond, name); log('OK', name); };

  const moves = [['rechts (vinger)', 220, 0, 'touch'], ['links (vinger)', -220, 0, 'touch'], ['boven (vinger)', 0, -120, 'touch'], ['rechts (muis)', 220, 0, 'mouse'], ['boven (muis)', 0, -120, 'mouse']];
  for (const [label, dx, dy, how] of moves) {
    await page.getByRole('button', { name: 'Succes' }).click();
    await toasts(page).first().waitFor();
    if (label === 'rechts (vinger)') {
      const b = await toasts(page).first().boundingBox();
      await check('toast bovenaan, niet over de onderbalk', b.y + b.height < (page.viewportSize().height - 100));
      await shot('toast');
    }
    await swipe(page, dx, dy, how);
    await check(`wegswipen naar ${label}`, (await count()) === 0);
  }
  // Sluitkruisje bij een fout.
  await page.getByRole('button', { name: 'Fout' }).click();
  await toasts(page).first().waitFor();
  const close = page.locator('[data-sonner-toast] [data-close-button]').first();
  await check('sluitkruisje zichtbaar', await close.isVisible());
  const cb = await close.boundingBox();
  await check('sluitkruisje minstens 26 px', cb.width >= 26 && cb.height >= 26);
  await shot('fout');
  await close.click();
  await page.waitForTimeout(500);
  await check('sluitkruisje sluit', (await count()) === 0);
  // Duur: gewone melding weg na ~4 s, fout nog zichtbaar na 5 s (8 s).
  if (width === 390) {
    await page.getByRole('button', { name: 'Gewoon' }).click();
    await page.getByRole('button', { name: 'Fout' }).click();
    await page.waitForTimeout(5200);
    const left = await toasts(page).allInnerTexts();
    await check('gewone melding weg na 5 s', !left.some((t) => t.includes('Gewone melding')));
    await check('fout nog zichtbaar na 5 s', left.some((t) => t.includes('Dat lukte niet')));
    await page.waitForTimeout(3500);
    await check('fout weg na 8,7 s', (await count()) === 0);
  }
  log(`${checks} controles groen`);
}
