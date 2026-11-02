// KASSA-MOBIEL-1 — keukenkop: elke knop volledig binnen het scherm, geen horizontale overloop.
export const widths = [390, 1024, 1280];
export async function run(page, { width, shot, log }) {
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const vw = window.innerWidth;
    const items = [...document.querySelectorAll('header button, header a, header select, header [role="combobox"]')];
    const out = items.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > vw + 0.5); })
      .map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim());
    const h = document.querySelector('header').getBoundingClientRect();
    return { count: items.length, out, over: document.documentElement.scrollWidth - vw, headerH: Math.round(h.height), headerW: Math.round(h.width) };
  });
  log('kop: bedieningselementen', res.count, '| buiten beeld:', JSON.stringify(res.out), '| overloop px', res.over, '| kophoogte', res.headerH);
  if (res.out.length || res.over > 0) throw new Error(`Keukenkop loopt over op ${width}px: ${JSON.stringify(res)}`);
  await shot('kop');
}
