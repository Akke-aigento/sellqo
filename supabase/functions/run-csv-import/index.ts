// CSV Import Edge Function v3 - Fixed customer_type constraint
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface ImportRequest {
  tenant_id: string;
  platform: string;
  data_type: "customers" | "products" | "orders";
  records: Record<string, unknown>[];
  options: {
    updateExisting: boolean;
    skipErrors?: boolean;
  };
}

interface ImportResult {
  job_id: string;
  status: "completed" | "failed";
  total_rows: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  errors: Array<{ row: number; error: string; severity: "error" | "warning" }>;
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ImportRequest = await req.json();
    const { tenant_id, platform, data_type, records, options } = body;

    if (!tenant_id || !data_type || !records?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, data_type, records" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create import job record
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .insert({
        tenant_id,
        source_platform: platform,
        data_type,
        status: "processing",
        total_rows: records.length,
        options: options,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create import job:", jobError);
      throw new Error(`Failed to create import job: ${jobError.message}`);
    }

    const result: ImportResult = {
      job_id: job.id,
      status: "completed",
      total_rows: records.length,
      success_count: 0,
      skipped_count: 0,
      failed_count: 0,
      errors: [],
      duration_ms: 0,
    };

    try {
      if (data_type === "customers") {
        await importCustomers(supabase, tenant_id, records, options, result);
      } else if (data_type === "products") {
        // Debug: log first record to check variant data
        if (records.length > 0) {
          const first = records[0];
          console.log('[EDGE FUNC] First product record keys:', Object.keys(first));
          console.log('[EDGE FUNC] _variants_json present:', '_variants_json' in first, 'type:', typeof first._variants_json);
          if (first._variants_json) {
            console.log('[EDGE FUNC] _variants_json value (first 300 chars):', String(first._variants_json).substring(0, 300));
          } else {
            console.log('[EDGE FUNC] _variants_json is MISSING from record!');
          }
          console.log('[EDGE FUNC] _option1_name:', first._option1_name, '_option2_name:', first._option2_name);
        }
        await importProducts(supabase, tenant_id, records, options, result);
      } else if (data_type === "orders") {
        await importOrders(supabase, tenant_id, records, options, result);
      }
    } catch (importError) {
      console.error(`Import error for ${data_type}:`, importError);
      result.status = "failed";
      result.errors.push({
        row: 0,
        error: importError instanceof Error ? importError.message : String(importError),
        severity: "error",
      });
    }

    result.duration_ms = Date.now() - startTime;

    // Update import job with results
    await supabase
      .from("import_jobs")
      .update({
        status: result.status,
        success_count: result.success_count,
        skipped_count: result.skipped_count,
        failed_count: result.failed_count,
        errors: result.errors,
        completed_at: new Date().toISOString(),
        duration_ms: result.duration_ms,
      })
      .eq("id", job.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============= CUSTOMERS IMPORT =============
async function importCustomers(
  supabase: AnySupabaseClient,
  tenantId: string,
  records: Record<string, unknown>[],
  options: ImportRequest["options"],
  result: ImportResult
) {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const email = record.email as string;
      if (!email) {
        result.errors.push({ row: i + 1, error: "Missing email", severity: "error" });
        result.failed_count++;
        continue;
      }

      // Check for existing customer
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .maybeSingle();

      const customerData = buildCustomerData(tenantId, record);

      if (existing && options.updateExisting) {
        // Update existing
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", existing.id);
        
        if (error) throw error;
        result.success_count++;
      } else if (existing) {
        // Skip existing
        result.skipped_count++;
      } else {
        // Insert new
        const { error } = await supabase.from("customers").insert(customerData);
        if (error) throw error;
        result.success_count++;
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (typeof err === 'object' && err !== null && 'message' in err) 
          ? String((err as { message: unknown }).message) 
          : JSON.stringify(err);
      console.error(`Customer row ${i + 1} error:`, errorMessage);
      result.errors.push({
        row: i + 1,
        error: errorMessage,
        severity: "error",
      });
      result.failed_count++;
      if (!options.skipErrors) throw err;
    }
  }
}

function buildCustomerData(tenantId: string, record: Record<string, unknown>) {
  // Build billing address JSON
  const billingAddress: Record<string, unknown> = {};
  if (record.billing_street) billingAddress.street = record.billing_street;
  if (record.billing_city) billingAddress.city = record.billing_city;
  if (record.billing_postal_code) billingAddress.postal_code = record.billing_postal_code;
  if (record.billing_country) billingAddress.country = record.billing_country;
  if (record.province) billingAddress.province = record.province;
  if (record.province_code) billingAddress.province_code = record.province_code;

  // Build shipping address JSON
  const shippingAddress: Record<string, unknown> = {};
  if (record.shipping_street) shippingAddress.street = record.shipping_street;
  if (record.shipping_city) shippingAddress.city = record.shipping_city;
  if (record.shipping_postal_code) shippingAddress.postal_code = record.shipping_postal_code;
  if (record.shipping_country) shippingAddress.country = record.shipping_country;

  return {
    tenant_id: tenantId,
    email: record.email as string,
    first_name: record.first_name || null,
    last_name: record.last_name || null,
    phone: record.phone || null,
    company_name: record.company_name || null,
    billing_street: record.billing_street || null,
    billing_city: record.billing_city || null,
    billing_postal_code: record.billing_postal_code || null,
    billing_country: record.billing_country || null,
    shipping_street: record.shipping_street || null,
    shipping_city: record.shipping_city || null,
    shipping_postal_code: record.shipping_postal_code || null,
    shipping_country: record.shipping_country || null,
    province: record.province || null,
    province_code: record.province_code || null,
    default_billing_address: Object.keys(billingAddress).length > 0 ? billingAddress : null,
    default_shipping_address: Object.keys(shippingAddress).length > 0 ? shippingAddress : null,
    vat_number: record.vat_number || null,
    notes: record.notes || null,
    tags: Array.isArray(record.tags) ? record.tags : record.tags ? [record.tags] : [],
    customer_type: record.customer_type === "b2b" || record.customer_type === "business" ? "b2b" : "b2c",
    email_subscribed: record.email_subscribed ?? true,
    sms_subscribed: record.sms_subscribed ?? false,
    total_spent: parseFloat(String(record.total_spent || 0)) || 0,
    total_orders: parseInt(String(record.total_orders || 0)) || 0,
    raw_import_data: record.raw_import_data || null,
    shopify_customer_id: record.shopify_customer_id || null,
    import_source: record.import_source || "csv",
  };
}

// ============= PRODUCTS IMPORT =============
async function importProducts(
  supabase: AnySupabaseClient,
  tenantId: string,
  records: Record<string, unknown>[],
  options: ImportRequest["options"],
  result: ImportResult
) {
  // Cache for category lookups: lowercase name → category id
  const categoryCache = new Map<string, string>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const name = record.name as string;
      const sku = record.sku as string;
      
      if (!name) {
        result.errors.push({ row: i + 1, error: "Missing product name", severity: "error" });
        result.failed_count++;
        continue;
      }

      // Check for existing product (by SKU if available, otherwise skip duplicate check)
      let existing = null;
      if (sku) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("sku", sku)
          .maybeSingle();
        existing = data;
      }

      const productData = buildProductData(tenantId, record);

      let productId: string;

      if (existing && options.updateExisting) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", existing.id);
        
        if (error) throw error;
        productId = existing.id;
        result.success_count++;
      } else if (existing) {
        result.skipped_count++;
        // Still link category for existing products
        productId = existing.id;
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        if (error) throw error;
        productId = newProduct.id;
        result.success_count++;
      }

      // Auto-link category from original_category_value (Shopify "Type")
      const categoryValue = (record.original_category_value as string) || "";
      if (categoryValue.trim()) {
        await linkProductToCategory(supabase, tenantId, productId, categoryValue.trim(), categoryCache);
      }

      // Upsert product specifications from _spec_ prefixed fields
      await upsertProductSpecs(supabase, tenantId, productId, record);

      // Upsert custom specs from _custom_spec_ prefixed fields
      await upsertCustomSpecs(supabase, tenantId, productId, record);

      // Import variants from _variants_json (Shopify consolidated rows)
      await importProductVariants(supabase, tenantId, productId, record);
    } catch (err) {
      console.error(`Product row ${i + 1} error:`, err);
      result.errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : String(err),
        severity: "error",
      });
      result.failed_count++;
      if (!options.skipErrors) throw err;
    }
  }
}

async function linkProductToCategory(
  supabase: AnySupabaseClient,
  tenantId: string,
  productId: string,
  categoryName: string,
  cache: Map<string, string>
) {
  const cacheKey = categoryName.toLowerCase();

  let categoryId = cache.get(cacheKey);

  if (!categoryId) {
    // Look up existing category (case-insensitive)
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", cacheKey)
      .maybeSingle();

    if (existing) {
      categoryId = existing.id;
    } else {
      // Create new category
      const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data: newCat, error } = await supabase
        .from("categories")
        .insert({ tenant_id: tenantId, name: categoryName, slug, is_active: true })
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to create category "${categoryName}":`, error);
        return;
      }
      categoryId = newCat.id;
    }
    cache.set(cacheKey, categoryId);
  }

  // Upsert product-category link
  await supabase
    .from("product_categories")
    .upsert(
      { product_id: productId, category_id: categoryId },
      { onConflict: "product_id,category_id" }
    );

  // Also set legacy category_id on the product for compatibility
  await supabase
    .from("products")
    .update({ category_id: categoryId })
    .eq("id", productId);
}

// ============= UPSERT PRODUCT SPECIFICATIONS =============
async function upsertProductSpecs(
  supabase: AnySupabaseClient,
  tenantId: string,
  productId: string,
  record: Record<string, unknown>
) {
  const specFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("_spec_") && value) {
      const column = key.replace("_spec_", "");
      specFields[column] = String(value);
    }
  }

  if (Object.keys(specFields).length === 0) return;

  try {
    // Check if spec row exists
    const { data: existing } = await supabase
      .from("product_specifications")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("product_specifications")
        .update(specFields)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("product_specifications")
        .insert({ product_id: productId, tenant_id: tenantId, ...specFields });
    }
  } catch (err) {
    console.error(`Failed to upsert specs for product ${productId}:`, err);
  }
}

// ============= UPSERT CUSTOM SPECIFICATIONS =============
async function upsertCustomSpecs(
  supabase: AnySupabaseClient,
  tenantId: string,
  productId: string,
  record: Record<string, unknown>
) {
  const customSpecs: Array<{ group: string; key: string; value: string }> = [];

  for (const [field, value] of Object.entries(record)) {
    if (field.startsWith("_custom_spec_") && value) {
      // Format: _custom_spec_GroupName_spec_key
      const rest = field.replace("_custom_spec_", "");
      const firstUnderscore = rest.indexOf("_");
      if (firstUnderscore === -1) continue;
      const group = rest.substring(0, firstUnderscore);
      const key = rest.substring(firstUnderscore + 1).replace(/_/g, " ");
      customSpecs.push({ group, key, value: String(value) });
    }
  }

  if (customSpecs.length === 0) return;

  try {
    // Delete existing custom specs for this product in the same groups
    const groups = [...new Set(customSpecs.map((s) => s.group))];
    for (const group of groups) {
      await supabase
        .from("product_custom_specs")
        .delete()
        .eq("product_id", productId)
        .eq("group_name", group);
    }

    // Insert new custom specs
    const rows = customSpecs.map((spec, idx) => ({
      product_id: productId,
      tenant_id: tenantId,
      group_name: spec.group,
      spec_key: spec.key,
      spec_value: spec.value,
      value_type: "text" as const,
      sort_order: idx,
      group_sort_order: 0,
    }));

    if (rows.length > 0) {
      await supabase.from("product_custom_specs").insert(rows);
    }
  } catch (err) {
    console.error(`Failed to upsert custom specs for product ${productId}:`, err);
  }
}

// ============= IMPORT PRODUCT VARIANTS =============
async function importProductVariants(
  supabase: AnySupabaseClient,
  tenantId: string,
  productId: string,
  record: Record<string, unknown>
) {
  const variantsJson = record._variants_json as string;
  if (!variantsJson) return;

  try {
    const variants: Array<{
      sku: string;
      price: string;
      compare_at_price: string;
      stock: string;
      option1: string;
      option2: string;
      option3: string;
      barcode: string;
      image: string;
      weight: string;
      requires_shipping: string;
    }> = JSON.parse(variantsJson);

    if (!variants.length) return;

    // Filter out "Default Title" — not real variants
    const realVariants = variants.filter(v => v.option1?.trim().toLowerCase() !== 'default title');
    if (realVariants.length === 0) {
      console.log(`[variants] Skipping Default Title variants for product ${productId}`);
      return;
    }

    // Read option names from consolidated record
    const optionNames: string[] = [];
    if (record._option1_name) optionNames.push(String(record._option1_name));
    if (record._option2_name) optionNames.push(String(record._option2_name));
    if (record._option3_name) optionNames.push(String(record._option3_name));

    // Fallback option names
    if (optionNames.length === 0) optionNames.push("Option 1");

    // Step 1: Build and upsert product_variant_options
    const optionValuesMap = new Map<string, Set<string>>();
    for (const v of realVariants) {
      const vals = [v.option1, v.option2, v.option3];
      for (let i = 0; i < optionNames.length; i++) {
        const val = vals[i]?.trim();
        if (val) {
          if (!optionValuesMap.has(optionNames[i])) {
            optionValuesMap.set(optionNames[i], new Set());
          }
          optionValuesMap.get(optionNames[i])!.add(val);
        }
      }
    }

    // Delete existing variant options for this product, then insert fresh
    await supabase
      .from("product_variant_options")
      .delete()
      .eq("product_id", productId);

    const optionRows = Array.from(optionValuesMap.entries()).map(([name, valuesSet], idx) => ({
      product_id: productId,
      tenant_id: tenantId,
      name,
      values: Array.from(valuesSet),
      position: idx,
    }));

    if (optionRows.length > 0) {
      const { error: optError } = await supabase
        .from("product_variant_options")
        .insert(optionRows);
      if (optError) console.error("Failed to insert variant options:", optError);
    }

    // Step 2: Upsert product_variants
    for (const v of realVariants) {
      const attributeValues: Record<string, string> = {};
      const titleParts: string[] = [];
      const vals = [v.option1, v.option2, v.option3];

      for (let i = 0; i < optionNames.length; i++) {
        const val = vals[i]?.trim();
        if (val) {
          attributeValues[optionNames[i]] = val;
          titleParts.push(val);
        }
      }

      const variantTitle = titleParts.join(" / ") || "Default";
      const variantSku = v.sku?.trim() || null;
      const variantBarcode = v.barcode?.trim() || null;

      const variantData: Record<string, unknown> = {
        product_id: productId,
        tenant_id: tenantId,
        title: variantTitle,
        price: parseFloat(v.price) || 0,
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        stock: parseInt(v.stock) || 0,
        sku: variantSku || null,
        barcode: variantBarcode || null,
        attribute_values: attributeValues,
        image_url: v.image?.trim() || null,
        weight: v.weight ? parseFloat(v.weight) / 1000 : null, // grams → kg
        is_active: true,
      };

      // Try upsert by SKU if available, otherwise insert
      if (variantSku) {
        const { data: existingVariant } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", productId)
          .eq("sku", variantSku)
          .maybeSingle();

        if (existingVariant) {
          await supabase
            .from("product_variants")
            .update(variantData)
            .eq("id", existingVariant.id);
        } else {
          await supabase.from("product_variants").insert(variantData);
        }
      } else {
        // No SKU — check by attribute_values match
        const { data: existingVariant } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", productId)
          .eq("attribute_values", attributeValues)
          .maybeSingle();

        if (existingVariant) {
          await supabase
            .from("product_variants")
            .update(variantData)
            .eq("id", existingVariant.id);
        } else {
          await supabase.from("product_variants").insert(variantData);
        }
      }
    }

    console.log(`Imported ${variants.length} variants for product ${productId}`);
  } catch (err) {
    console.error(`Failed to import variants for product ${productId}:`, err);
  }
}

function buildProductData(tenantId: string, record: Record<string, unknown>) {
  // Generate slug from name if not provided
  const name = record.name as string;
  const slug = (record.slug as string) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return {
    tenant_id: tenantId,
    name,
    slug,
    description: record.description || null,
    short_description: record.short_description || null,
    price: parseFloat(String(record.price || 0)) || 0,
    compare_at_price: record.compare_at_price ? parseFloat(String(record.compare_at_price)) : null,
    cost_price: record.cost_price ? parseFloat(String(record.cost_price)) : null,
    sku: record.sku || null,
    barcode: record.barcode || null,
    stock: parseInt(String(record.stock || 0)) || 0,
    track_inventory: record.track_inventory ?? true,
    weight: record.weight ? parseFloat(String(record.weight)) : null,
    tags: Array.isArray(record.tags) ? record.tags : record.tags ? [record.tags] : [],
    images: Array.isArray(record.images) ? record.images : [],
    featured_image: record.featured_image || (Array.isArray(record.images) && record.images.length > 0 ? record.images[0] : null),
    meta_title: record.meta_title || null,
    meta_description: record.meta_description || null,
    is_active: record.is_active ?? true,
    vendor: record.vendor || null,
    original_category_value: record.original_category_value || null,
    google_product_category: record.google_product_category || null,
    shopify_product_id: record.shopify_product_id || null,
    shopify_handle: record.shopify_handle || null,
    import_source: record.import_source || "csv",
    raw_import_data: record.raw_import_data || null,
  };
}

// ============= ORDERS IMPORT =============
async function importOrders(
  supabase: AnySupabaseClient,
  tenantId: string,
  records: Record<string, unknown>[],
  options: ImportRequest["options"],
  result: ImportResult
) {
  // Group records by order_number (Shopify CSV = 1 row per line item)
  const orderGroups = new Map<string, Record<string, unknown>[]>();
  
  for (const record of records) {
    const orderNum = (record.order_number as string) || "";
    if (!orderNum) continue;
    
    if (!orderGroups.has(orderNum)) {
      orderGroups.set(orderNum, []);
    }
    orderGroups.get(orderNum)!.push(record);
  }

  let orderIndex = 0;
  for (const [orderNumber, rows] of orderGroups) {
    orderIndex++;
    try {
      const firstRow = rows[0];

      // Check for existing order
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("order_number", orderNumber)
        .maybeSingle();

      // Find or create customer by email
      let customerId: string | null = null;
      const customerEmail = firstRow.customer_email as string;
      if (customerEmail) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("email", customerEmail)
          .maybeSingle();
        
        if (customer) {
          customerId = customer.id;
        } else {
          // Create minimal customer record
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              tenant_id: tenantId,
              email: customerEmail,
              first_name: firstRow.customer_name ? String(firstRow.customer_name).split(" ")[0] : null,
              last_name: firstRow.customer_name ? String(firstRow.customer_name).split(" ").slice(1).join(" ") : null,
              phone: firstRow.customer_phone || null,
            })
            .select("id")
            .single();
          
          if (newCustomer) customerId = newCustomer.id;
        }
      }

      const orderData = buildOrderData(tenantId, firstRow, customerId);

      let orderId: string;

      if (existing && options.updateExisting) {
        // Update existing order
        const { error: updateError } = await supabase
          .from("orders")
          .update(orderData)
          .eq("id", existing.id);
        
        if (updateError) throw updateError;
        orderId = existing.id;

        // Delete existing order items
        await supabase.from("order_items").delete().eq("order_id", orderId);
      } else if (existing) {
        result.skipped_count++;
        continue;
      } else {
        // Insert new order
        const { data: newOrder, error: insertError } = await supabase
          .from("orders")
          .insert(orderData)
          .select("id")
          .single();
        
        if (insertError) throw insertError;
        orderId = newOrder.id;
      }

      // Insert order items from all rows in this group
      for (const row of rows) {
        await insertOrderItem(supabase, tenantId, orderId, row);
      }

      result.success_count++;
    } catch (err) {
      console.error(`Order ${orderNumber} error:`, err);
      result.errors.push({
        row: orderIndex,
        error: err instanceof Error ? err.message : String(err),
        severity: "error",
      });
      result.failed_count++;
      if (!options.skipErrors) throw err;
    }
  }
}

function buildOrderData(tenantId: string, record: Record<string, unknown>, customerId: string | null) {
  return {
    tenant_id: tenantId,
    customer_id: customerId,
    order_number: record.order_number as string,
    customer_email: record.customer_email || null,
    customer_name: record.customer_name || null,
    customer_phone: record.customer_phone || null,
    status: mapOrderStatus(record.status as string),
    payment_status: mapPaymentStatus(record.payment_status as string),
    subtotal: parseFloat(String(record.subtotal || 0)) || 0,
    shipping_cost: parseFloat(String(record.shipping_cost || 0)) || 0,
    tax_amount: parseFloat(String(record.tax_amount || 0)) || 0,
    discount_amount: parseFloat(String(record.discount_amount || 0)) || 0,
    total: parseFloat(String(record.total || 0)) || 0,
    currency: (record.currency as string) || "EUR",
    billing_address: record.billing_address || null,
    shipping_address: record.shipping_address || null,
    notes: record.notes || null,
    internal_notes: record.internal_notes || null,
    external_reference: record.external_reference || null,
    marketplace_source: record.marketplace_source || "shopify",
    marketplace_order_id: record.marketplace_order_id || null,
    raw_marketplace_data: record.raw_marketplace_data || null,
    import_source: record.import_source || "csv",
    original_created_at: record.original_created_at || null,
  };
}

async function insertOrderItem(
  supabase: AnySupabaseClient,
  tenantId: string,
  orderId: string,
  row: Record<string, unknown>
) {
  // Extract line item data from raw_marketplace_data or direct fields
  const rawData = (row.raw_marketplace_data || {}) as Record<string, unknown>;
  
  const productName = (rawData.lineitem_name as string) || (row.product_name as string) || "Unknown Product";
  const sku = (rawData.lineitem_sku as string) || (row.sku as string) || null;
  const quantity = parseInt(String(rawData.lineitem_quantity || row.quantity || 1)) || 1;
  const unitPrice = parseFloat(String(rawData.lineitem_price || row.unit_price || 0)) || 0;

  // Try to find product by SKU
  let productId: string | null = null;
  if (sku) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sku", sku)
      .maybeSingle();
    
    if (product) productId = product.id;
  }

  await supabase.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    product_name: productName,
    product_sku: sku,
    quantity,
    unit_price: unitPrice,
    total_price: unitPrice * quantity,
    vendor: rawData.lineitem_vendor || null,
    variant_title: rawData.lineitem_variant || null,
    marketplace_order_item_id: rawData.lineitem_id || null,
  });
}

function mapOrderStatus(status: string | undefined): string {
  if (!status) return "pending";
  const s = status.toLowerCase();
  if (s.includes("fulfil") || s.includes("shipped")) return "shipped";
  if (s.includes("deliver")) return "delivered";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("refund")) return "refunded";
  // Valid enum values: pending, confirmed, processing, shipped, delivered, cancelled, refunded
  return "pending";
}

function mapPaymentStatus(status: string | undefined): string {
  if (!status) return "pending";
  const s = status.toLowerCase();
  if (s.includes("paid")) return "paid";
  if (s.includes("refund")) return "refunded";
  if (s.includes("partial")) return "partially_paid";
  if (s.includes("void") || s.includes("cancel")) return "cancelled";
  return "pending";
}
