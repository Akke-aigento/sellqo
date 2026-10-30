// AI-AGENT-1 — acties van de hulpassistent (voorraad, prijs, uitverkocht).
//
// Beslissingen Akke (30-10): altijd eerst bevestigen; in alle betaalde plannen
// (feature-sleutel `ai_actions`); elke uitgevoerde actie kost 1 AI-credit.
//
// Werking: het model krijgt tools. `find_products` wordt meteen uitgevoerd (alleen lezen,
// binnen de winkel). De `propose_*`-tools voeren NIETS uit: ze worden gevalideerd tegen de
// echte data en komen als voorstel (kaart met Uitvoeren/Annuleren) bij de gebruiker.
// Pas na een tik voert `ai-assistant-action` uit, met de rechten van de gebruiker en
// via dezelfde paden als de UI (record_stock_movement, set_product_sold_out_today, update).
//
// Dit bestand is puur (geen Deno-API's), zodat deno test de validatie kan toetsen.

export const AI_ACTIONS_FEATURE = "ai_actions";
export const AI_ACTION_CREDITS = 1;
export const MAX_PRICE = 100000;
export const MAX_STOCK_STEP = 100000;

export type ActionKind = "stock" | "price" | "sold_out" | "active" | "create_product" | "bulk_price" | "discount_code";

export interface ProductSnapshot {
  id: string;
  name: string;
  is_active?: boolean;
  price: number;
  stock: number | null;
  track_inventory: boolean | null;
  sold_out_until: string | null;
  variants: Array<{ id: string; name: string; stock: number | null; track_inventory: boolean | null }>;
}

export interface ActionProposal {
  kind: ActionKind;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  /** Leesbare weergave vóór en na (stock als getal, prijs in euro, uitverkocht als boolean). */
  before: number | boolean | null;
  after: number | boolean;
  /** Voor stock: het verschil dat uitgevoerd wordt, en of het om bijtellen of vastzetten gaat. */
  delta?: number;
  mode?: "add" | "set";
  /** Voor stock in add-modus: het gevraagde aantal (kan afwijken van delta als de voorraad op 0 botst). */
  amount?: number;
  /** De winkel waarvoor het voorstel geldt (server zet dit). */
  tenant_id?: string;
  /** AI-AGENT-2: extra gegevens per soort (nieuw product, bulkregels, kortingscode). */
  payload?: Record<string, unknown>;
}

// ── AI-AGENT-2: extra acties ────────────────────────────────────────────────
export const MAX_BULK = 50;
export const DISCOUNT_TYPES = ["percentage", "fixed_amount", "free_shipping"] as const;

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";
}

/** Nieuwe prijs bij een bulkwijziging, afgerond op 2 decimalen (of op ,x0/,x5 als round_to). */
export function bulkNewPrice(current: number, mode: unknown, value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  let p: number;
  if (mode === "percent") p = current * (1 + value / 100);
  else if (mode === "amount") p = current + value;
  else if (mode === "set") p = value;
  else return null;
  p = Math.round(p * 100) / 100;
  // Bijtellen/procent mag nooit op €0 uitkomen (bv. -100%); enkel "set" mag een exacte prijs zetten.
  if (mode !== "set" && p <= 0) return null;
  return p < 0 || p > MAX_PRICE ? null : p;
}

export function buildCreateProduct(args: Record<string, unknown>, existingSlugs: Set<string>, categoryId: string | null): Result<ActionProposal> {
  const name = typeof args.name === "string" ? args.name.trim().slice(0, 150) : "";
  if (name.length < 2) return { ok: false, error: "invalid_name" };
  if (typeof args.price !== "number" || !Number.isFinite(args.price) || args.price < 0 || args.price > MAX_PRICE) return { ok: false, error: "invalid_price" };
  const price = Math.round(args.price * 100) / 100;
  const base = slugify(name);
  let slug = base;
  for (let i = 2; existingSlugs.has(slug) && i < 200; i++) slug = `${base}-${i}`;
  const description = typeof args.description === "string" ? args.description.slice(0, 4000) : "";
  return { ok: true, value: {
    kind: "create_product", product_id: "", variant_id: null, product_name: name, before: null, after: price,
    payload: { name, slug, price, description, category_id: categoryId, category_name: categoryId ? args.category_name ?? null : null, is_food: args.is_food === true },
  } };
}


export const AI_ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "find_products",
      description: "Search the shop's own products by name (or SKU) to get their id, current price, stock, sold-out state and variants. Always call this before proposing a change, and use the returned id.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Part of the product name or SKU" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_stock_change",
      description: "Propose a stock change for one product (or one variant). Nothing changes until the user confirms. Use mode 'add' to add or remove units (negative amount removes), 'set' to set the stock to an exact number.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          variant_id: { type: "string", description: "Required when the product has variants" },
          mode: { type: "string", enum: ["add", "set"] },
          amount: { type: "integer" },
        },
        required: ["product_id", "mode", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_price_change",
      description: "Propose a new selling price (in euro, incl. VAT as shown in the shop) for one product. Nothing changes until the user confirms.",
      parameters: {
        type: "object",
        properties: { product_id: { type: "string" }, new_price: { type: "number" } },
        required: ["product_id", "new_price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_sold_out",
      description: "Propose marking a product as sold out for today on the menu/shop (sold_out=true), or available again (sold_out=false). Nothing changes until the user confirms.",
      parameters: {
        type: "object",
        properties: { product_id: { type: "string" }, sold_out: { type: "boolean" } },
        required: ["product_id", "sold_out"],
      },
    },
  },
] as const;

export const isSoldOutNow = (until: string | null, now = new Date()) =>
  !!until && new Date(until).getTime() > now.getTime();

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Valideert een propose_*-aanroep tegen een productsnapshot. Geeft een voorstel of een fout. */
export function buildProposal(
  tool: string,
  args: Record<string, unknown>,
  product: ProductSnapshot | null,
  now = new Date(),
): Result<ActionProposal> {
  if (!product) return { ok: false, error: "product_not_found" };
  if (tool === "propose_stock_change") {
    const mode = args.mode;
    // Een ontbrekende waarde mag nooit stil 0 worden (Number(null) === 0).
    if (typeof args.amount !== "number") return { ok: false, error: "invalid_amount" };
    const amount = args.amount;
    if (mode !== "add" && mode !== "set") return { ok: false, error: "invalid_mode" };
    if (!Number.isInteger(amount) || Math.abs(amount) > MAX_STOCK_STEP) return { ok: false, error: "invalid_amount" };
    if (mode === "set" && amount < 0) return { ok: false, error: "invalid_amount" };
    const variantId = typeof args.variant_id === "string" && args.variant_id ? args.variant_id : null;
    let current: number;
    let name = product.name;
    if (product.variants.length > 0) {
      const v = product.variants.find((x) => x.id === variantId);
      if (!v) return { ok: false, error: "variant_required" };
      if (v.track_inventory === false) return { ok: false, error: "stock_not_tracked" };
      current = v.stock ?? 0;
      name = `${product.name} — ${v.name}`;
    } else {
      if (variantId) return { ok: false, error: "variant_not_found" };
      if (product.track_inventory === false) return { ok: false, error: "stock_not_tracked" };
      current = product.stock ?? 0;
    }
    const after = Math.max(0, mode === "set" ? amount : current + amount);
    const delta = after - current;
    if (delta === 0) return { ok: false, error: "no_change" };
    return { ok: true, value: { kind: "stock", product_id: product.id, variant_id: variantId, product_name: name, before: current, after, delta, mode, amount } };
  }
  if (tool === "propose_price_change") {
    if (typeof args.new_price !== "number") return { ok: false, error: "invalid_price" };
    const p = Math.round(args.new_price * 100) / 100;
    if (!Number.isFinite(p) || p < 0 || p > MAX_PRICE) return { ok: false, error: "invalid_price" };
    if (p === Number(product.price)) return { ok: false, error: "no_change" };
    return { ok: true, value: { kind: "price", product_id: product.id, variant_id: null, product_name: product.name, before: Number(product.price), after: p } };
  }
  if (tool === "propose_sold_out") {
    if (typeof args.sold_out !== "boolean") return { ok: false, error: "invalid_sold_out" };
    const before = isSoldOutNow(product.sold_out_until, now);
    if (before === args.sold_out) return { ok: false, error: "no_change" };
    return { ok: true, value: { kind: "sold_out", product_id: product.id, variant_id: null, product_name: product.name, before, after: args.sold_out } };
  }
  if (tool === "propose_set_active") {
    if (typeof args.active !== "boolean") return { ok: false, error: "invalid_active" };
    const before = (product as ProductSnapshot & { is_active?: boolean }).is_active !== false;
    if (before === args.active) return { ok: false, error: "no_change" };
    return { ok: true, value: { kind: "active", product_id: product.id, variant_id: null, product_name: product.name, before, after: args.active } };
  }
  return { ok: false, error: "unknown_tool" };
}

/**
 * Herberekent een bevestigde actie tegen de actuele data, vlak vóór uitvoeren.
 * Stock: het verschil wordt opnieuw bepaald t.o.v. de huidige stand, zodat een "zet op 14"
 * ook klopt als er intussen iets verkocht is; een "+10" blijft +10.
 */
export function revalidate(
  action: { kind: ActionKind; product_id: string; variant_id: string | null; after: unknown; delta?: unknown; mode?: unknown; amount?: unknown },
  product: ProductSnapshot | null,
  now = new Date(),
): Result<ActionProposal> {
  if (action.kind === "stock") {
    const mode = action.mode === "add" ? "add" : "set";
    // add: het oorspronkelijk gevraagde aantal (niet de geklemde delta); set: de doelwaarde.
    const amount = mode === "add" ? (typeof action.amount === "number" ? action.amount : action.delta) : action.after;
    return buildProposal("propose_stock_change", { mode, amount, variant_id: action.variant_id }, product, now);
  }
  if (action.kind === "price") return buildProposal("propose_price_change", { new_price: action.after }, product, now);
  if (action.kind === "sold_out") return buildProposal("propose_sold_out", { sold_out: action.after }, product, now);
  if (action.kind === "active") return buildProposal("propose_set_active", { active: action.after }, product, now);
  return { ok: false, error: "unknown_kind" };
}

/** Mag deze winkel acties gebruiken? Feature-vlag op het plan van een actief of proefabonnement. */
export function planAllowsActions(features: unknown): boolean {
  return !!features && typeof features === "object" && !Array.isArray(features)
    && (features as Record<string, unknown>)[AI_ACTIONS_FEATURE] === true;
}
