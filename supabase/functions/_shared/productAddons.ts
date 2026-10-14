// FOOD-1 — extra's (toppings, sauzen, bijgerechten) op een product. Pure functies: de
// storefront-api laadt de groepen die bij een product horen en valideert hier de keuze
// van de klant. De prijs komt altijd uit de databank, nooit van de klant.

/** ALLERGEN-2: `allergens` alleen als de winkel ze invulde (respons blijft anders gelijk). */
export interface AddonOption { id: string; name: string; price: number; allergens?: string[] }
export interface AddonGroup { id: string; name: string; min_select: number; max_select: number | null; options: AddonOption[] }
export interface ChosenAddon { group_id: string; group: string; option_id: string; name: string; price: number }
export interface AddonSelection { addons: ChosenAddon[]; total: number; key: string | null }

export class AddonError extends Error {
  constructor(public code: string, message: string, public group_id?: string) { super(message); }
}

interface GroupRow { id: string; name: string; min_select: number | null; max_select: number | null; category_ids: string[] | null; product_ids: string[] | null }
interface OptionRow { id: string; group_id: string; name: string; price: number | string | null; allergens?: string[] | null }

/** Groepen die gelden voor dit product (rechtstreeks of via een van zijn categorieën), met hun opties. */
export function applicableGroups(groups: GroupRow[], options: OptionRow[], productId: string, categoryIds: string[]): AddonGroup[] {
  return groups
    .filter((g) => (g.product_ids || []).includes(productId) || (g.category_ids || []).some((c) => categoryIds.includes(c)))
    .map((g) => ({
      id: g.id, name: g.name, min_select: Math.max(0, Number(g.min_select) || 0), max_select: g.max_select == null ? null : Number(g.max_select),
      options: options.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price: round2(Number(o.price) || 0), ...(o.allergens?.length ? { allergens: o.allergens } : {}) })),
    }))
    .filter((g) => g.options.length > 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Controleert de gekozen optie-ID's tegen de groepen van het product.
 * - onbekende optie → ADDON_INVALID
 * - te weinig of te veel in een groep → ADDON_MIN / ADDON_MAX
 * Dubbele ID's tellen één keer. `key` = gesorteerde optie-ID's (null zonder extra's), zodat
 * hetzelfde product met dezelfde extra's op dezelfde cartregel belandt.
 */
export function resolveAddonSelection(groups: AddonGroup[], selected: unknown): AddonSelection {
  const ids = Array.isArray(selected) ? [...new Set(selected.map((x) => String(x)))] : [];
  const byId = new Map<string, { g: AddonGroup; o: AddonOption }>();
  for (const g of groups) for (const o of g.options) byId.set(o.id, { g, o });
  const chosen: ChosenAddon[] = [];
  for (const id of ids) {
    const hit = byId.get(id);
    if (!hit) throw new AddonError('ADDON_INVALID', 'Deze extra is niet (meer) beschikbaar bij dit product');
    chosen.push({ group_id: hit.g.id, group: hit.g.name, option_id: hit.o.id, name: hit.o.name, price: hit.o.price });
  }
  for (const g of groups) {
    const n = chosen.filter((c) => c.group_id === g.id).length;
    if (n < g.min_select) throw new AddonError('ADDON_MIN', g.min_select === 1 ? `Kies een optie bij "${g.name}"` : `Kies minstens ${g.min_select} opties bij "${g.name}"`, g.id);
    if (g.max_select != null && n > g.max_select) throw new AddonError('ADDON_MAX', `Kies maximaal ${g.max_select} bij "${g.name}"`, g.id);
  }
  // Volgorde zoals in de admin (groep, dan optie), niet zoals de klant klikte.
  const order = new Map<string, number>();
  let i = 0;
  for (const g of groups) for (const o of g.options) order.set(o.id, i++);
  chosen.sort((a, b) => (order.get(a.option_id) ?? 0) - (order.get(b.option_id) ?? 0));
  const total = round2(chosen.reduce((s, c) => s + c.price, 0));
  const key = chosen.length ? chosen.map((c) => c.option_id).sort().join(',') : null;
  return { addons: chosen, total, key };
}

/** Korte omschrijving voor orderregels en mails: "Extra kaas, Champignons". */
export function addonsLabel(addons: { name: string }[] | null | undefined): string {
  return (addons || []).map((a) => a.name).filter(Boolean).join(', ');
}
