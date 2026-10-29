// KASSA-UX-1 — sneltikken: dezelfde knop nog eens tikken telt op dezelfde lijn op (3× Pils, niet
// drie lijnen), de tegel toont hoeveel er in deze ronde staat, en "−" haalt er één af. Enkel op
// lijnen die nog niet verstuurd zijn (ontwerp): wat al naar keuken/FDM ging, verandert hier nooit.
// Pure functies; de kassa stuurt de bestaande commando's add_line en change_qty.
import type { Check, CheckLine } from './types';

/** Een ontwerp-lijn waar een volgende tik van hetzelfde product bij mag. */
export function isMergeable(l: CheckLine, productId: string): boolean {
  return l.state === 'draft' && l.product_id === productId && l.qty > 0 && !l.corrects_line_id
    && l.addons.length === 0 && !l.note && l.price_changes.length === 0;
}

export type TapPlan = { kind: 'add' } | { kind: 'qty'; lineId: string; qty: number };

/** Wat een tik op een product doet: optellen op de laatste passende ontwerp-lijn, anders een nieuwe lijn. */
export function planTap(check: Pick<Check, 'lines'> | undefined, productId: string, hasAddons: boolean): TapPlan {
  if (!check || hasAddons) return { kind: 'add' };
  const hit = [...check.lines].sort((a, b) => b.seq - a.seq).find((l) => isMergeable(l, productId));
  return hit ? { kind: 'qty', lineId: hit.id, qty: Math.min(999, hit.qty + 1) } : { kind: 'add' };
}

/** "−" op een tegel: de laatste ontwerp-lijn van dat product één minder (0 = weg). null = niets te verminderen. */
export function planMinus(check: Pick<Check, 'lines'> | undefined, productId: string): { lineId: string; qty: number } | null {
  if (!check) return null;
  const hit = [...check.lines].sort((a, b) => b.seq - a.seq)
    .find((l) => l.state === 'draft' && l.product_id === productId && l.qty > 0 && !l.corrects_line_id);
  return hit ? { lineId: hit.id, qty: hit.qty - 1 } : null;
}

/** Aantal per product in de lopende ronde (ontwerp-lijnen), voor de badge op de tegel. */
export function draftCounts(check: Pick<Check, 'lines'> | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of check?.lines ?? []) {
    if (l.state !== 'draft' || !l.product_id || l.qty <= 0 || l.corrects_line_id) continue;
    m.set(l.product_id, (m.get(l.product_id) ?? 0) + l.qty);
  }
  return m;
}

/** Aantal stuks op de rekening (zonder geschrapte en negatieve lijnen), voor de balk onderaan. */
export function itemCount(check: Pick<Check, 'lines'> | undefined): number {
  return (check?.lines ?? []).reduce((s, l) => s + (l.qty <= 0 || l.state === 'void' ? 0 : l.state === 'draft' ? l.qty : l.open_qty), 0);
}

/**
 * "Populair": de meest verkochte producten uit recente kassalijnen, enkel producten die nu op
 * de kaart staan. Minder dan `min` verschillende producten = geen rij Populair (te weinig gegevens).
 */
export function popularIds(rows: { product_id: string | null; qty: number }[], available: Set<string>, limit = 12, min = 4): string[] {
  const sum = new Map<string, number>();
  for (const r of rows) {
    if (!r.product_id || !available.has(r.product_id) || !(r.qty > 0)) continue;
    sum.set(r.product_id, (sum.get(r.product_id) ?? 0) + r.qty);
  }
  const ids = [...sum.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([id]) => id);
  return ids.length >= min ? ids : [];
}

/** Vaste kleur per categorie (op volgorde), zodat een tegel in één oogopslag te plaatsen is. */
export const CATEGORY_TONES = [
  'border-l-amber-500', 'border-l-orange-600', 'border-l-rose-600', 'border-l-fuchsia-600',
  'border-l-sky-600', 'border-l-emerald-600', 'border-l-lime-600', 'border-l-violet-600',
] as const;
/** Zelfde kleuren als bolletje op de categorieknop. */
export const CATEGORY_DOTS = [
  'bg-amber-500', 'bg-orange-600', 'bg-rose-600', 'bg-fuchsia-600',
  'bg-sky-600', 'bg-emerald-600', 'bg-lime-600', 'bg-violet-600',
] as const;
export function categoryTone(index: number): string {
  return index < 0 ? 'border-l-slate-400' : CATEGORY_TONES[index % CATEGORY_TONES.length];
}
export function categoryDot(index: number): string {
  return index < 0 ? 'bg-slate-400' : CATEGORY_DOTS[index % CATEGORY_DOTS.length];
}

/** Rollen die vanuit de kassa naar het beheer mogen (zaakvoerder en verantwoordelijke). */
export const ADMIN_LINK_ROLES = new Set(['owner', 'manager']);

/** Waar "Naar beheer" heen gaat: in de SellQo-app (route /kassa) intern, in de aparte Kassa-app naar de site. */
export function adminHref(pathname: string, site: string): { href: string; external: boolean } {
  return pathname.startsWith('/kassa') ? { href: '/admin', external: false } : { href: `${site}/admin`, external: true };
}
