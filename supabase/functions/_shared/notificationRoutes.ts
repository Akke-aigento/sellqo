// NOTIF-DEEPLINK-1 — waar een melding naartoe leidt. Eén register voor de bel,
// de pushmelding en de knop in de meldingsmail.
//
// Tot 19 sep 2026 werd `action_url` rauw gevolgd. Die wordt op 42 plekken
// geschreven (edge functions, DB-triggers, frontend), en ruim de helft wees naar
// een pagina die niet bestaat: /admin/invoices…, /admin/quotes/:id,
// /admin/subscriptions, /admin/products/:id, /admin/settings?tab=…. Die bronnen
// blijven ongemoeid (keuze Akke, 19-09): de route wordt hier bepaald, bij het
// lezen, uit type + data. Daardoor werken ook alle bestaande rijen.
//
// Volgorde in `notificationRoute`:
//   1. de id in `data` (order_id, invoice_id, …) → het item zelf;
//   2. anders `action_url`, vertaald naar het canonieke pad;
//   3. anders de lijst van die categorie. Nooit het dashboard.
//
// Canonieke keuzes:
//   - facturen: /admin/orders/invoices?invoice=<id>. Er is geen factuurdetail-
//     pagina; de lijst zoekt op dat nummer. `?invoice=` was al het meest
//     gebruikte patroon (84 van 94 rijen in 90 dagen).
//   - producten: /admin/products/<id>/edit. De enige productpagina; elke link
//     in de app gebruikt hem.
//   - berichten: /admin/messages?conversation=<message_id>. De inbox zoekt het
//     gesprek dat dat bericht bevat. CustomerDetail linkt al zo.
//
// Puur en zonder imports: gedeeld met src/ en getest door vitest.

export interface NotificationLike {
  category?: string | null;
  type?: string | null;
  data?: unknown;
  action_url?: string | null;
}

/** De lijst per categorie — de terugval als er geen item te openen is. */
export const CATEGORY_LIST_ROUTES: Readonly<Record<string, string>> = {
  orders: "/admin/orders",
  invoices: "/admin/orders/invoices",
  payments: "/admin/payments",
  customers: "/admin/customers",
  products: "/admin/products",
  quotes: "/admin/orders/quotes",
  subscriptions: "/admin/orders/subscriptions",
  marketing: "/admin/marketing",
  team: "/admin/settings?section=team",
  system: "/admin/notifications",
  ai_coach: "/admin/marketing/ai-center",
  messages: "/admin/messages",
  integrations: "/admin/connect",
  returns: "/admin/returns",
  inventory: "/admin/products",
  shipping: "/admin/orders",
  billing: "/admin/billing",
};

export const FALLBACK_ROUTE = "/admin/notifications";

/** Types die naar een vaste pagina gaan, los van hun categorie. */
const TYPE_ROUTES: Readonly<Record<string, string>> = {
  ai_credits_low: "/admin/billing",
  ai_credits_empty: "/admin/billing",
  usage_limit_reached: "/admin/billing",
  platform_gift: "/admin/billing",
  trial_expiring: "/admin/billing",
  trial_expired: "/admin/billing",
};

// Settings.tsx leest alleen `?section=`. Oude `?tab=`- en `/settings/<x>`-links
// noemen soms iets dat een eigen pagina is, of een section met een andere naam.
const SETTINGS_ELSEWHERE: Readonly<Record<string, string>> = {
  billing: "/admin/billing",
  integrations: "/admin/connect",
  shipping: "/admin/shipping",
};
const SETTINGS_SECTION_ALIASES: Readonly<Record<string, string>> = {
  notifications: "shop-notifications",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idFrom(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/** Route naar het item zelf, als de data er een id voor heeft. */
function itemRoute(category: string, type: string, data: unknown): string | null {
  const id = (key: string) => idFrom(data, key);

  if (category === "messages") {
    const m = id("message_id");
    return m ? `/admin/messages?conversation=${m}` : null;
  }
  if (category === "invoices" || type.startsWith("invoice_") || type === "mandate_setup_stalled") {
    const i = id("invoice_id");
    return i ? `/admin/orders/invoices?invoice=${i}` : null;
  }
  if (category === "quotes") {
    const q = id("quote_id");
    return q ? `/admin/orders/quotes/${q}` : null;
  }
  if (category === "products" || category === "inventory") {
    const p = id("product_id");
    return p ? `/admin/products/${p}/edit` : null;
  }
  if (category === "customers") {
    const c = id("customer_id");
    return c ? `/admin/customers/${c}` : null;
  }
  if (category === "marketing") {
    const c = id("campaign_id");
    return c ? `/admin/marketing/campaigns/${c}` : null;
  }
  // Een retour heeft sinds NOTIF-SOURCES-1 categorie `orders` (de enum kent geen
  // `returns`) en draagt ook een order_id: het retour gaat voor.
  const r = id("return_id");
  if (r) return `/admin/returns/${r}`;
  // Bestellingen, betalingen (terugbetaling), verzending: allemaal de bestelling.
  const o = id("order_id");
  return o ? `/admin/orders/${o}` : null;
}

/**
 * Een opgeslagen pad naar zijn huidige, bestaande route. Alleen interne
 * admin-paden; een volledige URL of `//host` → null. Onbekende admin-paden gaan
 * ongewijzigd door (de router vangt ze op).
 */
export function canonicalAdminPath(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const raw = url.trim();
  if (raw !== "/admin" && !raw.startsWith("/admin/") && !raw.startsWith("/admin?")) return null;

  const [pathPart, queryPart = ""] = raw.split("?", 2);
  const path = pathPart.replace(/\/+$/, "") || "/admin";
  const query = new URLSearchParams(queryPart);
  const seg = path.split("/").filter(Boolean); // ["admin", ...]

  // /admin/invoices, /admin/invoices/:id, /admin/invoices?invoice=:id
  if (seg[1] === "invoices") {
    const id = seg[2] ?? query.get("invoice");
    return id ? `/admin/orders/invoices?invoice=${id}` : "/admin/orders/invoices";
  }
  // /admin/quotes, /admin/quotes/:id
  if (seg[1] === "quotes") {
    return seg[2] ? `/admin/orders/quotes/${seg[2]}` : "/admin/orders/quotes";
  }
  // /admin/subscriptions(/…)
  if (seg[1] === "subscriptions") return "/admin/orders/subscriptions";
  // /admin/products?id=:id en /admin/products/:id (maar niet new of :id/edit)
  if (seg[1] === "products") {
    const id = seg.length === 3 && seg[2] !== "new" ? seg[2] : query.get("id");
    if (id && seg.length <= 3) return `/admin/products/${id}/edit`;
    return raw;
  }
  if (seg[1] === "payouts") return "/admin/payments";
  if (seg[1] === "ai-center") return "/admin/marketing/ai-center";
  // /admin/settings/billing, /admin/settings?tab=billing|team|…
  if (seg[1] === "settings") {
    const section = seg[2] ?? query.get("tab");
    if (!section || query.get("section")) return raw;
    if (SETTINGS_ELSEWHERE[section]) return SETTINGS_ELSEWHERE[section];
    return `/admin/settings?section=${SETTINGS_SECTION_ALIASES[section] ?? section}`;
  }
  return raw;
}

/** Waar deze melding naartoe leidt. Altijd een admin-pad, nooit het dashboard. */
export function notificationRoute(n: NotificationLike): string {
  const category = n.category ?? "";
  const type = n.type ?? "";

  const item = itemRoute(category, type, n.data);
  if (item) return item;

  if (TYPE_ROUTES[type]) return TYPE_ROUTES[type];

  const fromUrl = canonicalAdminPath(n.action_url);
  if (fromUrl && fromUrl !== "/admin") return fromUrl;

  return CATEGORY_LIST_ROUTES[category] ?? FALLBACK_ROUTE;
}
