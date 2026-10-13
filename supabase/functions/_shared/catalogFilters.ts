// CATALOG-FILTERS-1 (13-10-2026) — filters en facetten voor de webshop-API.
//
// Pure helpers (geen databank), zodat ze testbaar zijn. storefront-api gebruikt ze voor
// de nieuwe actie get_product_filters en de nieuwe get_products-parameters `options`
// en `available_only`.
//
// Variant-opties zijn in de data rommelig: "White " met spatie, "s" naast "S",
// "Kleur" naast "Color". We groeperen op getrimde, hoofdletterongevoelige waarden en
// tonen de meest gebruikte schrijfwijze. Optienamen vertalen we niet (Kleur ≠ Color):
// dat is een keuze van de winkel.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = any;

export const normKey = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Parameter `options` → { optienaam(lower) → set van waarden(lower) }, of null. */
export function parseOptionFilter(raw: unknown): Map<string, Set<string>> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = new Map<string, Set<string>>();
  for (const [name, vals] of Object.entries(raw as Record<string, unknown>)) {
    const list = (Array.isArray(vals) ? vals : [vals]).map(normKey).filter(Boolean);
    if (normKey(name) && list.length > 0) out.set(normKey(name), new Set(list));
  }
  return out.size > 0 ? out : null;
}

function variantAttrs(v: DbRow): Map<string, string> {
  const m = new Map<string, string>();
  const av = v?.attribute_values;
  if (av && typeof av === 'object') for (const [k, val] of Object.entries(av)) m.set(normKey(k), normKey(val));
  return m;
}

export const variantInStock = (v: DbRow) => !v.track_inventory || Number(v.stock) > 0;
export const productInStock = (p: DbRow) => !p.track_inventory || Number(p.stock) > 0;

/**
 * Past een product bij de filter? Met varianten: minstens één actieve variant die bij
 * ELKE gevraagde optie een van de gekozen waarden heeft (en op voorraad is als
 * availableOnly). Zonder varianten: een optiefilter sluit het product uit;
 * availableOnly kijkt naar de voorraad van het product.
 */
export function productMatches(
  product: DbRow,
  variants: DbRow[],
  filter: Map<string, Set<string>> | null,
  availableOnly: boolean,
): boolean {
  if (variants.length === 0) {
    if (filter) return false;
    return availableOnly ? productInStock(product) : true;
  }
  return variants.some((v) => {
    if (availableOnly && !variantInStock(v)) return false;
    if (!filter) return true;
    const attrs = variantAttrs(v);
    for (const [name, allowed] of filter) {
      const val = attrs.get(name);
      if (!val || !allowed.has(val)) return false;
    }
    return true;
  });
}

const SIZE_ORDER = ['xxxs', 'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl'];

export function compareOptionValues(a: string, b: string): number {
  const ka = normKey(a), kb = normKey(b);
  const sa = SIZE_ORDER.indexOf(ka), sb = SIZE_ORDER.indexOf(kb);
  if (sa !== -1 && sb !== -1) return sa - sb;
  if (sa !== -1) return -1;
  if (sb !== -1) return 1;
  const na = parseFloat(ka), nb = parseFloat(kb);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return ka.localeCompare(kb, 'nl');
}

export interface FacetValue { value: string; count: number }
export interface OptionFacet { name: string; values: FacetValue[] }

/** Telt per optie en waarde in hoeveel producten ze voorkomen (één keer per product). */
export function buildOptionFacets(variantsByProduct: Map<string, DbRow[]>): OptionFacet[] {
  // optie(lower) → { label-tellingen, waarde(lower) → { productIds, label-tellingen } }
  const opts = new Map<string, { labels: Map<string, number>; values: Map<string, { products: Set<string>; labels: Map<string, number> }> }>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
  for (const [productId, variants] of variantsByProduct) {
    for (const v of variants) {
      const av = v?.attribute_values;
      if (!av || typeof av !== 'object') continue;
      for (const [rawName, rawVal] of Object.entries(av)) {
        const name = normKey(rawName), val = normKey(rawVal);
        if (!name || !val) continue;
        if (!opts.has(name)) opts.set(name, { labels: new Map(), values: new Map() });
        const o = opts.get(name)!;
        bump(o.labels, String(rawName).trim());
        if (!o.values.has(val)) o.values.set(val, { products: new Set(), labels: new Map() });
        const e = o.values.get(val)!;
        e.products.add(productId);
        bump(e.labels, String(rawVal).trim());
      }
    }
  }
  // Meest gebruikte schrijfwijze; bij gelijkstand die met een hoofdletter vooraan.
  const capFirst = (s: string) => (s[0] && s[0] !== s[0].toLowerCase() ? 0 : 1);
  const top = (m: Map<string, number>) => [...m.entries()]
    .sort((a, b) => b[1] - a[1] || capFirst(a[0]) - capFirst(b[0]) || a[0].localeCompare(b[0]))[0][0];
  return [...opts.values()]
    .map((o) => ({
      name: top(o.labels),
      values: [...o.values.values()]
        .map((e) => ({ value: top(e.labels), count: e.products.size }))
        .sort((a, b) => compareOptionValues(a.value, b.value)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** Tags met het aantal producten waarin ze voorkomen, meest gebruikt eerst. */
export function buildTagFacets(products: DbRow[]): FacetValue[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const p of products) {
    const seen = new Set<string>();
    for (const t of (Array.isArray(p.tags) ? p.tags : [])) {
      const k = normKey(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const e = counts.get(k) || { label: String(t).trim(), n: 0 };
      e.n++;
      counts.set(k, e);
    }
  }
  return [...counts.values()].map((e) => ({ value: e.label, count: e.n })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'nl'));
}
