// EVENT-WIZARD-1 — pure helpers voor de wizard "Nieuw event": datums van een reeks en een
// unieke slug. Los van React zodat ze testbaar zijn.

/** Datums (yyyy-mm-dd) van een wekelijkse reeks vanaf `start`, `weeks` keer, op dezelfde weekdag. */
export function weeklyDates(start: string, weeks: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const n = Math.max(1, Math.min(52, Math.floor(weeks) || 1));
  const [y, m, d] = start.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i * 7));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export function slugBase(name: string): string {
  const s = name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'event';
}

/** Eerste vrije slug: basis, basis-2, basis-3, … gegeven de slugs die al bestaan. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const c = `${base}-${i}`;
    if (!set.has(c)) return c;
  }
  return `${base}-${Date.now()}`;
}
