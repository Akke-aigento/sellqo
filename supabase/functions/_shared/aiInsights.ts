// AI-AGENT-2 — cijfers voor de hulpassistent (puur, testbaar met deno test).
//
// "Eén bron per getal": de regels hieronder zijn een letterlijke kopie van src/lib/salesStats.ts
// (isRevenueOrder, resolveOrderChannel) en src/lib/cockpitRevenue.ts (kassatickets zonder order
// tellen mee), zodat de assistent dezelfde omzet noemt als het dashboard. Wijzig je daar iets,
// wijzig het hier mee (aiInsights.test.ts bevat dezelfde gevallen).
// Dagen gelden in Europe/Brussels.

export type OrderRow = {
  id: string; created_at: string; total: number | string | null; status?: string | null;
  payment_status?: string | null; marketplace_source?: string | null; sales_channel?: string | null;
  discount_amount?: number | string | null;
};
export type PosRow = { created_at: string; total: number | string | null; status?: string | null; order_id?: string | null };
export type ItemRow = {
  order_id: string; product_id: string | null; product_name: string | null; quantity: number | null;
  total_price: number | string | null; vat_amount: number | string | null;
  /** Kostprijs op het moment van verkoop (sinds AI-AGENT-2); null = onbekend → huidige kostprijs. */
  cost_price?: number | string | null;
};

const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export const isRevenueOrder = (o: { status?: string | null; payment_status?: string | null }) =>
  o.payment_status === "paid" && o.status !== "cancelled";

export const resolveOrderChannel = (o: { marketplace_source?: string | null; sales_channel?: string | null }): string => {
  if (o.marketplace_source && o.marketplace_source !== "web" && o.marketplace_source !== "shopify_draft_order" && o.marketplace_source !== "csv_import") {
    return o.marketplace_source;
  }
  if (o.marketplace_source === "shopify_draft_order" || o.marketplace_source === "csv_import") return "webshop";
  return o.sales_channel && o.sales_channel !== "webshop" ? o.sales_channel : "webshop";
};
export const POS_CHANNEL = "pos";

// ── Tijdzone ────────────────────────────────────────────────────────────────
const TZ = "Europe/Brussels";
function tzOffsetMinutes(ts: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts) / 60000;
}
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** Middernacht in Brussel als UTC-tijdstip. */
export function brusselsMidnightUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMinutes(guess) * 60000;
  t = guess - tzOffsetMinutes(t) * 60000; // tweede pas rond zomer/wintertijd
  return new Date(t);
}
export function brusselsYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** [from, to] inclusief, in Brussel; max. 366 dagen. */
export function parseRange(from: unknown, to: unknown): { ok: true; from: string; to: string; startIso: string; endIso: string; days: number } | { ok: false; error: string } {
  const f = String(from ?? ""), t = String(to ?? from ?? "");
  if (!YMD.test(f) || !YMD.test(t)) return { ok: false, error: "invalid_date" };
  if (t < f) return { ok: false, error: "invalid_range" };
  const days = Math.round((Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10))) / 86400000) + 1;
  if (days > 366) return { ok: false, error: "range_too_long" };
  return { ok: true, from: f, to: t, startIso: brusselsMidnightUtc(f).toISOString(), endIso: brusselsMidnightUtc(addDays(t, 1)).toISOString(), days };
}

// ── Omzet ───────────────────────────────────────────────────────────────────
export function salesSummary(orders: OrderRow[], pos: PosRow[], range: { from: string; to: string; days: number }) {
  const byChannel = new Map<string, { revenue: number; count: number }>();
  const byDay = new Map<string, number>();
  let revenue = 0, count = 0;
  const add = (at: string, channel: string, amount: number) => {
    revenue += amount; count += 1;
    const c = byChannel.get(channel) ?? { revenue: 0, count: 0 };
    c.revenue += amount; c.count += 1; byChannel.set(channel, c);
    const day = brusselsYmd(new Date(at));
    byDay.set(day, (byDay.get(day) ?? 0) + amount);
  };
  for (const o of orders) if (isRevenueOrder(o)) add(o.created_at, resolveOrderChannel(o), num(o.total));
  for (const p of pos) if (p.status === "completed" && !p.order_id) add(p.created_at, POS_CHANNEL, num(p.total));
  return {
    from: range.from, to: range.to,
    revenue_incl_vat: r2(revenue),
    sales_count: count,
    average_ticket: count ? r2(revenue / count) : 0,
    by_channel: [...byChannel.entries()].map(([channel, v]) => ({ channel, revenue: r2(v.revenue), count: v.count })).sort((a, b) => b.revenue - a.revenue),
    by_day: range.days <= 62 ? [...byDay.entries()].sort().map(([day, v]) => ({ day, revenue: r2(v) })) : undefined,
    note: "Omzet = betaalde, niet-geannuleerde bestellingen + kassatickets zonder bestelling (zelfde regel als het dashboard). Incl. btw.",
  };
}

// ── Kortingen per order ─────────────────────────────────────────────────────
/**
 * Een kortingscode staat enkel op orderniveau (orders.discount_amount), niet op de regels
 * (les Fonske 27-10: €309 valse omzet). Per order een factor (regels − korting) / regels,
 * die we op elke regel toepassen, zodat winst en top-producten niet te hoog uitvallen.
 */
export function discountFactors(orders: OrderRow[], items: ItemRow[]): Map<string, number> {
  const lineSum = new Map<string, number>();
  for (const it of items) lineSum.set(it.order_id, (lineSum.get(it.order_id) ?? 0) + num(it.total_price));
  const f = new Map<string, number>();
  for (const o of orders) {
    const d = num(o.discount_amount), ls = lineSum.get(o.id) ?? 0;
    if (d > 0 && ls > 0) f.set(o.id, Math.max(0, (ls - d) / ls));
  }
  return f;
}

// ── Winst (schatting) ───────────────────────────────────────────────────────
/** costs: product_id → huidige kostprijs (excl. btw). Regels zonder kostprijs tellen niet mee in de marge. */
export function profitEstimate(items: ItemRow[], revenueOrderIds: Set<string>, costs: Map<string, number>, factors: Map<string, number> = new Map()) {
  let netWithCost = 0, cost = 0, netWithout = 0, linesWithout = 0, exactLines = 0, linesWithCost = 0;
  const missing = new Map<string, string>();
  for (const it of items) {
    if (!revenueOrderIds.has(it.order_id)) continue;
    const net = (num(it.total_price) - num(it.vat_amount)) * (factors.get(it.order_id) ?? 1);
    const snap = it.cost_price != null && num(it.cost_price) > 0 ? num(it.cost_price) : undefined;
    const c = snap ?? (it.product_id ? costs.get(it.product_id) : undefined);
    if (c != null && c > 0) { netWithCost += net; cost += c * num(it.quantity); linesWithCost += 1; if (snap != null) exactLines += 1; }
    else { netWithout += net; linesWithout += 1; if (it.product_id) missing.set(it.product_id, it.product_name || ""); }
  }
  const profit = netWithCost - cost;
  const coverage = netWithCost + netWithout > 0 ? netWithCost / (netWithCost + netWithout) : 0;
  return {
    revenue_excl_vat_with_cost: r2(netWithCost),
    cost_of_goods: r2(cost),
    gross_profit_estimate: r2(profit),
    margin_pct: netWithCost > 0 ? Math.round((profit / netWithCost) * 1000) / 10 : null,
    revenue_excl_vat_without_cost: r2(netWithout),
    coverage_pct: Math.round(coverage * 1000) / 10,
    products_without_cost_price: [...missing.values()].filter(Boolean).slice(0, 15),
    exact_cost_lines_pct: linesWithCost ? Math.round((exactLines / linesWithCost) * 1000) / 10 : 0,
    note: "Brutowinst = verkoop excl. btw − kostprijs × aantal, enkel voor producten met een kostprijs. Waar de kostprijs bij de verkoop bewaard werd (exact_cost_lines_pct) is dat exact, anders met de huidige kostprijs (schatting). Kortingscodes zijn per order naar rato van de regels verrekend. Kassatickets zonder bestelling, verzendkosten en betaalkosten zitten er niet in.",
  };
}

export function topProducts(items: ItemRow[], revenueOrderIds: Set<string>, by: "revenue" | "quantity", limit: number, factors: Map<string, number> = new Map()) {
  const m = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const it of items) {
    if (!revenueOrderIds.has(it.order_id)) continue;
    const key = it.product_id || `name:${it.product_name}`;
    const row = m.get(key) ?? { name: it.product_name || "?", quantity: 0, revenue: 0 };
    row.quantity += num(it.quantity); row.revenue += num(it.total_price) * (factors.get(it.order_id) ?? 1);
    m.set(key, row);
  }
  return [...m.values()]
    .map((r) => ({ ...r, revenue: r2(r.revenue) }))
    .sort((a, b) => (by === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue))
    .slice(0, Math.min(Math.max(1, limit), 100));
}

export const LIST_FILTERS = ["all", "low_stock", "out_of_stock", "no_image", "no_cost_price", "inactive", "no_description"] as const;
export type ListFilter = typeof LIST_FILTERS[number];
