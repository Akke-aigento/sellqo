// AI-AGENT-1 — data-ophaling voor de assistent-acties. Altijd binnen één winkel (tenant_id).
import type { ProductSnapshot } from "./aiActions.ts";
import type { ItemRow, ListFilter, OrderRow, PosRow } from "./aiInsights.ts";

// deno-lint-ignore no-explicit-any
type Client = any;

const PRODUCT_COLS = "id, name, sku, price, stock, track_inventory, sold_out_until, is_active";

async function withVariants(client: Client, tenantId: string, rows: Array<Record<string, unknown>>): Promise<ProductSnapshot[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as string);
  const { data: vars } = await client
    .from("product_variants")
    .select("id, product_id, title, stock, track_inventory, is_active")
    .eq("tenant_id", tenantId)
    .in("product_id", ids);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    is_active: r.is_active !== false,
    price: Number(r.price ?? 0),
    stock: (r.stock as number | null) ?? null,
    track_inventory: (r.track_inventory as boolean | null) ?? null,
    sold_out_until: (r.sold_out_until as string | null) ?? null,
    variants: ((vars ?? []) as Array<Record<string, unknown>>)
      .filter((v) => v.product_id === r.id && v.is_active !== false)
      .map((v) => ({
        id: v.id as string,
        name: (v.title as string) || "",
        stock: (v.stock as number | null) ?? null,
        track_inventory: (v.track_inventory as boolean | null) ?? null,
      })),
  }));
}

/** Zoekt producten van de winkel op naam of SKU (max. 8). */
export async function findProducts(client: Client, tenantId: string, query: string): Promise<ProductSnapshot[]> {
  const q = String(query || "").replace(/[%,()"\\]/g, " ").trim().slice(0, 80);
  if (!q) return [];
  const { data } = await client
    .from("products")
    .select(PRODUCT_COLS)
    .eq("tenant_id", tenantId)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .order("name")
    .limit(8);
  return withVariants(client, tenantId, data ?? []);
}

/** Eén product van de winkel, of null als het niet (meer) bestaat of van een andere winkel is. */
export async function loadProduct(client: Client, tenantId: string, productId: string): Promise<ProductSnapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(productId || ""))) return null;
  const { data } = await client
    .from("products")
    .select(PRODUCT_COLS)
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (!data) return null;
  return (await withVariants(client, tenantId, [data]))[0] ?? null;
}

/** Plan van de winkel (actief of proef) → features. */
export async function tenantPlanFeatures(client: Client, tenantId: string): Promise<unknown> {
  const { data: sub } = await client
    .from("tenant_subscriptions")
    .select("plan_id, status")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.plan_id) return null;
  const { data: plan } = await client.from("pricing_plans").select("features").eq("id", sub.plan_id).maybeSingle();
  return plan?.features ?? null;
}

// ── AI-AGENT-2: cijfers en lijsten ─────────────────────────────────────────

export const SALES_CAP = 20000;
async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = SALES_CAP): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function fetchSales(client: Client, tenantId: string, startIso: string, endIso: string): Promise<{ orders: OrderRow[]; pos: PosRow[]; truncated: boolean }> {
  const [orders, pos] = await Promise.all([
    pageAll<OrderRow>((f, t) => client.from("orders")
      .select("id, created_at, total, status, payment_status, marketplace_source, sales_channel, discount_amount")
      .eq("tenant_id", tenantId).gte("created_at", startIso).lt("created_at", endIso).order("created_at").range(f, t)),
    pageAll<PosRow>((f, t) => client.from("pos_transactions")
      .select("created_at, total, status, order_id")
      .eq("tenant_id", tenantId).eq("status", "completed").gte("created_at", startIso).lt("created_at", endIso).order("created_at").range(f, t)),
  ]);
  // Afgekapt = te veel rijen voor één vraag: de assistent moet dat melden, nooit stil te laag rapporteren.
  return { orders, pos, truncated: orders.length >= SALES_CAP || pos.length >= SALES_CAP };
}

export async function fetchItems(client: Client, orderIds: string[]): Promise<ItemRow[]> {
  const out: ItemRow[] = [];
  for (let i = 0; i < orderIds.length; i += 300) {
    const chunk = orderIds.slice(i, i + 300);
    const rows = await pageAll<ItemRow>((f, t) => client.from("order_items")
      .select("order_id, product_id, product_name, quantity, total_price, vat_amount, cost_price")
      .in("order_id", chunk).range(f, t));
    out.push(...rows);
  }
  return out;
}

export async function fetchCosts(client: Client, tenantId: string, productIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (let i = 0; i < productIds.length; i += 300) {
    const { data } = await client.from("products").select("id, cost_price").eq("tenant_id", tenantId).in("id", productIds.slice(i, i + 300));
    for (const r of (data ?? []) as Array<{ id: string; cost_price: number | null }>) if (r.cost_price != null) m.set(r.id, Number(r.cost_price));
  }
  return m;
}

export async function listProducts(client: Client, tenantId: string, filter: ListFilter, query: string, limit: number) {
  let q = client.from("products")
    .select("id, name, sku, price, cost_price, stock, track_inventory, is_active, featured_image, images, description, low_stock_threshold")
    .eq("tenant_id", tenantId);
  const s = String(query || "").replace(/[%,()"\\]/g, " ").trim().slice(0, 80);
  if (s) q = q.ilike("name", `%${s}%`);
  if (filter === "inactive") q = q.eq("is_active", false);
  if (filter === "no_cost_price") q = q.is("cost_price", null);
  if (filter === "out_of_stock") q = q.eq("track_inventory", true).lte("stock", 0);
  const { data } = await q.order("name").limit(1000);
  let rows = (data ?? []) as Array<Record<string, unknown>>;
  if (filter === "low_stock") rows = rows.filter((r) => r.track_inventory && Number(r.stock ?? 0) > 0 && Number(r.stock ?? 0) <= Number(r.low_stock_threshold ?? 5));
  if (filter === "no_image") rows = rows.filter((r) => !r.featured_image && !(Array.isArray(r.images) && r.images.length));
  if (filter === "no_description") rows = rows.filter((r) => !String(r.description ?? "").replace(/<[^>]*>/g, "").trim());
  const total = rows.length;
  return {
    total,
    rows: rows.slice(0, Math.min(Math.max(1, limit || 200), 500)).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      sku: (r.sku as string) || "",
      price: Number(r.price ?? 0),
      cost_price: r.cost_price == null ? null : Number(r.cost_price),
      stock: r.track_inventory ? Number(r.stock ?? 0) : null,
      active: r.is_active !== false,
    })),
  };
}

export async function findCategory(client: Client, tenantId: string, name: string): Promise<{ id: string; name: string } | null> {
  const s = String(name || "").replace(/[%,()"\\]/g, " ").trim().slice(0, 80);
  if (!s) return null;
  const { data } = await client.from("categories").select("id, name").eq("tenant_id", tenantId).ilike("name", `%${s}%`).limit(5);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  return rows.find((r) => r.name.toLowerCase() === s.toLowerCase()) ?? (rows.length === 1 ? rows[0] : null);
}

/** Producten voor een bulkwijziging: via categorie (incl. koppeltabel) of naam. Max. 51 om "te veel" te herkennen. */
export async function productsForBulk(client: Client, tenantId: string, categoryId: string | null, query: string) {
  let ids: string[] | null = null;
  if (categoryId) {
    const { data: links } = await client.from("product_categories").select("product_id").eq("category_id", categoryId).limit(200);
    const { data: direct } = await client.from("products").select("id").eq("tenant_id", tenantId).eq("category_id", categoryId).limit(200);
    ids = [...new Set([...(links ?? []), ...(direct ?? [])].map((r: { product_id?: string; id?: string }) => (r.product_id ?? r.id) as string))];
    if (!ids.length) return [];
  }
  let q = client.from("products").select("id, name, price").eq("tenant_id", tenantId);
  if (ids) q = q.in("id", ids.slice(0, 200));
  const s = String(query || "").replace(/[%,()"\\]/g, " ").trim().slice(0, 80);
  if (s) q = q.ilike("name", `%${s}%`);
  if (!ids && !s) return [];
  const { data } = await q.order("name").limit(51);
  return (data ?? []) as Array<{ id: string; name: string; price: number }>;
}
