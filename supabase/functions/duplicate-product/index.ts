import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Columns we strip from products before re-inserting the duplicate.
const STRIPPED_PRODUCT_COLUMNS = new Set<string>([
  "id",
  "created_at",
  "updated_at",
  // Marketplace IDs / sync state — must NOT be copied (would collide with original listings)
  "shopify_product_id",
  "shopify_variant_id",
  "shopify_listing_status",
  "shopify_listing_error",
  "shopify_last_synced_at",
  "shopify_handle",
  "bol_offer_id",
  "bol_listing_status",
  "bol_listing_error",
  "bol_last_synced_at",
  "amazon_asin",
  "amazon_offer_id",
  "amazon_listing_status",
  "amazon_listing_error",
  "amazon_last_synced_at",
  "ebay_item_id",
  "ebay_offer_id",
  "ebay_listing_status",
  "ebay_listing_error",
  "ebay_last_synced_at",
  // Aggregates / stats — must reset on copy
  "views_count",
  "sales_count",
  "revenue_total",
  "last_sold_at",
  "last_viewed_at",
]);

function randomSuffix(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let auth;
  try {
    auth = await authenticateRequest(req);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    return json(500, { error: "Authentication failed" });
  }

  let body: { product_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const productId = body.product_id;
  if (!productId || typeof productId !== "string") {
    return json(400, { error: "product_id is required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Fetch original product
  const { data: original, error: fetchError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (fetchError) return json(500, { error: fetchError.message });
  if (!original) return json(404, { error: "Product niet gevonden" });

  // 2. Tenant access check
  if (!auth.is_platform_admin && !auth.tenant_ids.includes(original.tenant_id)) {
    return json(403, { error: "Geen toegang tot dit product" });
  }
  const tenantId: string = original.tenant_id;

  // 3. Build new product payload
  const newProduct: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(original)) {
    if (STRIPPED_PRODUCT_COLUMNS.has(k)) continue;
    newProduct[k] = v;
  }

  // Overrides
  const suffix = randomSuffix();
  newProduct.name = `${original.name ?? "Product"} (kopie)`;
  newProduct.is_active = false;
  if (original.slug) {
    newProduct.slug = `${original.slug}-kopie-${suffix}`;
  }
  if (original.sku) {
    newProduct.sku = `${original.sku}-COPY-${suffix.toUpperCase()}`;
  }
  // Reset marketplace lock flags (safer default — user re-enables consciously)
  newProduct.marketplace_lock_shopify = false;
  newProduct.marketplace_lock_bol_com = false;
  newProduct.marketplace_lock_amazon = false;
  newProduct.marketplace_lock_ebay = false;

  // 4. Insert duplicate product
  const { data: inserted, error: insertError } = await supabase
    .from("products")
    .insert(newProduct)
    .select("id")
    .single();

  if (insertError || !inserted) {
    return json(500, { error: insertError?.message ?? "Insert failed" });
  }
  const newProductId: string = inserted.id;

  // Compensation rollback helper
  const rollback = async (reason: string) => {
    console.error("[duplicate-product] rollback:", reason);
    await supabase.from("products").delete().eq("id", newProductId);
  };

  try {
    // 5. Copy product_categories (junction)
    const { data: cats } = await supabase
      .from("product_categories")
      .select("category_id, is_primary, sort_order")
      .eq("product_id", productId);
    if (cats && cats.length > 0) {
      const rows = cats.map((c) => ({ ...c, product_id: newProductId }));
      const { error } = await supabase.from("product_categories").insert(rows);
      if (error) throw new Error(`product_categories: ${error.message}`);
    }

    // 6. Copy product_variant_options (option definitions: name + values)
    const { data: opts } = await supabase
      .from("product_variant_options")
      .select("tenant_id, name, values, position")
      .eq("product_id", productId);
    if (opts && opts.length > 0) {
      const rows = opts.map((o) => ({ ...o, product_id: newProductId, tenant_id: tenantId }));
      const { error } = await supabase.from("product_variant_options").insert(rows);
      if (error) throw new Error(`product_variant_options: ${error.message}`);
    }

    // 7. Copy product_variants (deep — prices, stock, attributes...)
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);
    if (variants && variants.length > 0) {
      const rows = variants.map((v) => {
        const copy: Record<string, unknown> = { ...v };
        delete copy.id;
        delete copy.created_at;
        delete copy.updated_at;
        copy.product_id = newProductId;
        copy.tenant_id = tenantId;
        // Uniqueness: SKU/barcode appended with suffix to avoid collisions
        if (copy.sku) copy.sku = `${copy.sku}-COPY-${suffix.toUpperCase()}`;
        if (copy.barcode) copy.barcode = null; // Barcodes must be globally unique — clear
        return copy;
      });
      const { error } = await supabase.from("product_variants").insert(rows);
      if (error) throw new Error(`product_variants: ${error.message}`);
    }

    // 8. Copy product_specifications (1:1 row)
    const { data: specs } = await supabase
      .from("product_specifications")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    if (specs) {
      const copy: Record<string, unknown> = { ...specs };
      delete copy.id;
      delete copy.created_at;
      delete copy.updated_at;
      copy.product_id = newProductId;
      copy.tenant_id = tenantId;
      const { error } = await supabase.from("product_specifications").insert(copy);
      if (error) throw new Error(`product_specifications: ${error.message}`);
    }

    // 9. Copy product_custom_specs
    const { data: customSpecs } = await supabase
      .from("product_custom_specs")
      .select("*")
      .eq("product_id", productId);
    if (customSpecs && customSpecs.length > 0) {
      const rows = customSpecs.map((c) => {
        const copy: Record<string, unknown> = { ...c };
        delete copy.id;
        delete copy.created_at;
        delete copy.updated_at;
        copy.product_id = newProductId;
        copy.tenant_id = tenantId;
        return copy;
      });
      const { error } = await supabase.from("product_custom_specs").insert(rows);
      if (error) throw new Error(`product_custom_specs: ${error.message}`);
    }

    // 10. Copy product_files (digital deliverables — share underlying storage objects)
    const { data: files } = await supabase
      .from("product_files")
      .select("*")
      .eq("product_id", productId);
    if (files && files.length > 0) {
      const rows = files.map((f) => {
        const copy: Record<string, unknown> = { ...f };
        delete copy.id;
        delete copy.created_at;
        delete copy.updated_at;
        copy.product_id = newProductId;
        copy.tenant_id = tenantId;
        return copy;
      });
      const { error } = await supabase.from("product_files").insert(rows);
      if (error) throw new Error(`product_files: ${error.message}`);
    }

    // 11. Copy content_translations (entity_type='product')
    const { data: translations } = await supabase
      .from("content_translations")
      .select("*")
      .eq("entity_type", "product")
      .eq("entity_id", productId);
    if (translations && translations.length > 0) {
      const rows = translations.map((t) => {
        const copy: Record<string, unknown> = { ...t };
        delete copy.id;
        delete copy.created_at;
        delete copy.updated_at;
        copy.entity_id = newProductId;
        copy.tenant_id = tenantId;
        return copy;
      });
      const { error } = await supabase.from("content_translations").insert(rows);
      if (error) throw new Error(`content_translations: ${error.message}`);
    }

    return json(200, { id: newProductId });
  } catch (err) {
    await rollback(err instanceof Error ? err.message : String(err));
    return json(500, { error: err instanceof Error ? err.message : "Duplication failed" });
  }
});