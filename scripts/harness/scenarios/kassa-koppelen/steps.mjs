// KASSA-ACCOUNT-1 — per scherm een vers tabblad (zie horeca-beheer); fouten tellen zoals in shoot.mjs.
export const setup = {};
export async function run(page, { width, log }) {
  const base = page.url().split('?')[0];
  const browser = page.context().browser();
  const errors = [];
  for (const s of ['pair', 'pair-owner', 'revoked', 'error', 'admin']) {
    const p = await browser.newPage({ viewport: page.viewportSize() });
    p.on('pageerror', (e) => errors.push(`[${width} ${s}] ${e}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${width} ${s}] ${m.text()}`); });
    const shot = (n) => p.screenshot({ path: `/tmp/harness/kassa-koppelen-${width}-${n}.png`, fullPage: true });
    await p.goto(`${base}?screen=${s}`);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(500);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) log(s, 'HORIZONTALE OVERLOOP', over);
    if (s === 'pair') {
      await shot('pair');
      await p.getByLabel('Koppelcode').fill('12345');
      await p.getByRole('button', { name: 'Koppelen' }).click();
      log(s, 'te kort:', await p.getByRole('alert').innerText());
      await p.getByLabel('Koppelcode').fill('999 999');
      await p.getByRole('button', { name: 'Koppelen' }).click();
      await p.getByRole('alert').waitFor();
      log(s, 'fout:', await p.getByRole('alert').innerText());
      await shot('pair-fout');
      await p.getByLabel('Koppelcode').fill('111111');
      await p.getByRole('button', { name: 'Koppelen' }).click();
      await p.waitForTimeout(300);
      log(s, 'te veel:', await p.getByRole('alert').innerText());
      await p.getByLabel('Koppelcode').fill('222222');
      await p.getByRole('button', { name: 'Koppelen' }).click();
      await p.waitForTimeout(300);
      log(s, 'al gekoppeld:', await p.getByRole('alert').innerText());
      await shot('pair-al-gekoppeld');
      await p.getByLabel('Koppelcode').fill('482 913');
      await p.getByRole('button', { name: 'Koppelen' }).click();
      await p.waitForTimeout(300);
      log(s, 'aanroepen:', JSON.stringify(await p.evaluate(() => window.__calls.map((c) => [c.name, c.body?.code ?? c.body?.email]))));
      const dev = await p.evaluate(() => window.__calls.find((c) => c.name === 'kassa-device-pair')?.body?.device_uuid);
      log(s, 'device_uuid bewaard:', dev === await p.evaluate(() => localStorage.getItem('sq_kassa_device_uuid')));
    } else if (s === 'pair-owner') {
      // KASSA-MOBIEL-1: één tik met de beheer-sessie; beheer-client maakt de code, kassa-client ruilt hem in.
      await p.getByRole('button', { name: 'Dit toestel nu koppelen' }).waitFor();
      log(s, 'terug:', JSON.stringify(await p.locator('a').evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute('href')]))));
      log(s, 'zaken:', (await p.locator('select').first().locator('option').allInnerTexts()).join(' | '));
      await shot('pair-owner');
      await p.locator('select').nth(1).selectOption('t3');
      await p.getByRole('button', { name: 'Dit toestel nu koppelen' }).click();
      await p.waitForTimeout(400);
      log(s, 'aanroepen:', JSON.stringify(await p.evaluate(() => window.__calls.map((c) => [c.name, c.client, c.body?.p_terminal_id ?? (c.body?.code ? 'token' : c.body?.email)]))));
    } else if (s === 'admin') {
      log(s, 'lijst:', (await p.locator('li').allInnerTexts()).join(' | '));
      log(s, 'knoppen Toestel koppelen:', await p.getByRole('button', { name: 'Toestel koppelen' }).count(), '| Ontkoppelen:', await p.getByRole('button', { name: 'Ontkoppelen' }).count());
      await shot('admin');
      await p.getByRole('button', { name: 'Toestel koppelen' }).click();
      await p.getByTestId('pair-code').waitFor();
      log(s, 'code:', await p.getByTestId('pair-code').innerText(), '|', await p.locator('[role="dialog"] p.text-sm').last().innerText());
      await shot('admin-code');
      await p.evaluate(() => window.__pairNow());
      await p.getByRole('status').waitFor();
      log(s, 'na koppelen:', await p.getByRole('status').innerText());
      await shot('admin-gekoppeld');
      await p.getByRole('button', { name: 'Sluiten' }).first().click();
      await p.waitForTimeout(300);
      await p.getByRole('button', { name: 'Ontkoppelen' }).first().click();
      await p.getByRole('alertdialog').waitFor();
      log(s, 'bevestigen:', (await p.getByRole('alertdialog').innerText()).replace(/\n/g, ' · '));
      await shot('admin-ontkoppelen');
      await p.getByRole('alertdialog').getByRole('button', { name: 'Ontkoppelen' }).click();
      await p.waitForTimeout(500);
      log(s, 'revoke:', JSON.stringify(await p.evaluate(() => window.__calls.filter((c) => c.name === 'kassa-device-revoke'))));
    } else {
      log(s, (await p.locator('#root').innerText()).replace(/\n/g, ' · '));
      log(s, 'links:', JSON.stringify(await p.locator('a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.getAttribute('target')]))));
      await shot(s);
    }
    await p.close();
  }
  if (errors.length) throw new Error('Fouten:\n' + errors.join('\n'));
}
