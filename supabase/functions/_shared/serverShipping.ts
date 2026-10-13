// SEC-SHIP-1 (13-10-2026) — verzendkost altijd server-side bepalen.
//
// create-checkout-session en create-bank-transfer-order namen `shipping_cost`
// letterlijk over uit de request-body. Productprijzen werden al server-side
// gecontroleerd, verzending niet: wie de functie rechtstreeks aanriep, kon zelf
// zijn verzendkost kiezen (bv. 0). Nu komt de prijs uit shipping_methods.

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function resolveServerShippingCost(
  supabase: Db,
  tenantId: string,
  shippingMethodId: string | null | undefined,
  requestedCost: number | null | undefined,
  subtotal: number,
): Promise<number> {
  if (!shippingMethodId) {
    if (Number(requestedCost) > 0) {
      throw new Error("shipping_method_id is required when shipping_cost > 0");
    }
    return 0;
  }
  const { data: method, error } = await supabase
    .from("shipping_methods")
    .select("id, price, free_above, is_active")
    .eq("id", shippingMethodId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!method || method.is_active === false) throw new Error("Unknown or inactive shipping method");
  const freeAbove = method.free_above != null ? Number(method.free_above) : null;
  if (freeAbove != null && subtotal >= freeAbove) return 0;
  return Math.round(Number(method.price || 0) * 100) / 100;
}
