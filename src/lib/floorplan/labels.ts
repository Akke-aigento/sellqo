// ZAAL-H1 — tafellabels: automatisch doornummeren ("B1".."B9", "Ter-1".."Ter-3", "12"),
// geldigheid en dubbele labels. Een label is uniek per ruimte (index in de migratie),
// maar de keuken toont enkel het label: daarom waarschuwen we ook bij dubbels over
// ruimtes heen.
import { LABEL_RE } from './types';

/** "B4" → { prefix: "B", n: 4 }; "Ter-12" → { prefix: "Ter-", n: 12 }; "Salon" → { prefix: "Salon", n: null }. */
export function splitLabel(label: string): { prefix: string; n: number | null } {
  const m = label.trim().match(/^(.*?)(\d+)$/);
  if (!m) return { prefix: label.trim(), n: null };
  return { prefix: m[1], n: Number(m[2]) };
}

export function isValidLabel(label: string): boolean {
  return LABEL_RE.test(label.trim());
}

const norm = (s: string) => s.trim().toLowerCase();

/** Volgend vrij label met dit voorvoegsel: hoogste nummer + 1 (gaten worden niet opgevuld). */
export function nextLabel(existing: string[], prefix = ''): string {
  const p = norm(prefix);
  let max = 0;
  for (const l of existing) {
    const s = splitLabel(l);
    if (s.n !== null && norm(s.prefix) === p) max = Math.max(max, s.n);
  }
  let n = max + 1;
  const taken = new Set(existing.map(norm));
  while (taken.has(norm(`${prefix}${n}`))) n++;
  return `${prefix}${n}`;
}

/** `count` opeenvolgende vrije labels met dit voorvoegsel, vanaf het volgende vrije nummer. */
export function labelSeries(existing: string[], prefix: string, count: number): string[] {
  const out: string[] = [];
  const all = [...existing];
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    const l = nextLabel(all, prefix);
    out.push(l);
    all.push(l);
  }
  return out;
}

/** Label voor een kopie: "B4" → volgende in de B-reeks; "Salon" → "Salon 2". */
export function duplicateLabel(existing: string[], label: string): string {
  const s = splitLabel(label);
  if (s.n !== null) return nextLabel(existing, s.prefix);
  const base = `${label.trim()} `;
  return nextLabel(existing, base.length > 14 ? base.slice(0, 14) : base);
}

/** Labels die meer dan eens voorkomen (hoofdletterongevoelig), voor een waarschuwing. */
export function duplicateLabels(labels: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const l of labels) seen.set(norm(l), (seen.get(norm(l)) ?? 0) + 1);
  return new Set([...seen].filter(([, c]) => c > 1).map(([k]) => k));
}

/** Natuurlijke sortering: "B2" vóór "B10", "Ter-1" na "B9". */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
