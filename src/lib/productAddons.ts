// FOOD-2 — extra's in de kassa. Zelfde regels als supabase/functions/_shared/productAddons.ts
// (webshop): een groep geldt via een product-ID of de categorie van het product.
export interface AddonOptionLite { id: string; name: string; price: number }
export interface AddonGroupLite { id: string; name: string; min_select: number; max_select: number | null; options: AddonOptionLite[] }
export interface ChosenAddon { group: string; name: string; price: number }

interface GroupRow { id: string; name: string; min_select: number; max_select: number | null; category_ids: string[] | null; product_ids: string[] | null; sort_order?: number }
interface OptionRow { id: string; group_id: string; name: string; price: number | string }

export function groupsForProduct(groups: GroupRow[], options: OptionRow[], productId: string, categoryIds: (string | null | undefined)[]): AddonGroupLite[] {
  const cats = categoryIds.filter(Boolean) as string[];
  return groups
    .filter((g) => (g.product_ids || []).includes(productId) || (g.category_ids || []).some((c) => cats.includes(c)))
    .map((g) => ({
      id: g.id, name: g.name, min_select: g.min_select || 0, max_select: g.max_select,
      options: options.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price: Math.round(Number(o.price) * 100) / 100 })),
    }))
    .filter((g) => g.options.length > 0);
}

/** Foutmelding of null; zelfde teksten als de webshop. */
export function addonSelectionError(groups: AddonGroupLite[], picked: string[]): string | null {
  for (const g of groups) {
    const n = g.options.filter((o) => picked.includes(o.id)).length;
    if (n < g.min_select) return g.min_select === 1 ? `Kies een optie bij "${g.name}"` : `Kies minstens ${g.min_select} opties bij "${g.name}"`;
    if (g.max_select != null && n > g.max_select) return `Kies maximaal ${g.max_select} bij "${g.name}"`;
  }
  return null;
}

export function chosenAddons(groups: AddonGroupLite[], picked: string[]): ChosenAddon[] {
  return groups.flatMap((g) => g.options.filter((o) => picked.includes(o.id)).map((o) => ({ group: g.name, name: o.name, price: o.price })));
}

export const addonsTotal = (a: ChosenAddon[] | undefined) => Math.round((a || []).reduce((s, x) => s + x.price, 0) * 100) / 100;
export const addonsKey = (a: ChosenAddon[] | undefined) => (a || []).map((x) => `${x.group}:${x.name}`).sort().join('|');
