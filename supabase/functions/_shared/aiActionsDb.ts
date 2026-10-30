// AI-AGENT-1 — data-ophaling voor de assistent-acties. Altijd binnen één winkel (tenant_id).
import type { ProductSnapshot } from "./aiActions.ts";

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
