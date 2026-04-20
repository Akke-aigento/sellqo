import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveLineVatBatch, resolveLineVatSync, extractVatFromGross } from "../_shared/vat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BANK-TRANSFER-ORDER] ${step}${detailsStr}`);
};

// EU countries for VAT determination
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// EU VAT rates by country
const EU_VAT_RATES: Record<string, number> = {
  'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
  'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
  'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
  'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 20,
  'SI': 22, 'ES': 21, 'SE': 25
};

/**
 * Generate a Belgian structured communication (OGM)
 * Format: +++XXX/XXXX/XXXXX+++ (12 digits, last 2 = modulo 97 checksum)
 */
function generateOGM(baseNumber: number | string): string {
  let numericBase = typeof baseNumber === 'string' 
    ? baseNumber.replace(/\D/g, '') 
    : baseNumber.toString();
  
  if (!numericBase || numericBase === '0') {
    numericBase = Date.now().toString().slice(-10);
  }
  
  numericBase = numericBase.slice(-10).padStart(10, '0');
  
  const baseNum = BigInt(numericBase);
  const remainder = Number(baseNum % 97n);
  const checksum = (remainder === 0 ? 97 : remainder).toString().padStart(2, '0');
  
  const full = numericBase + checksum;
  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7, 12)}+++`;
}

interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
}

interface BillingAddress {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface ServicePointData {
  id: string;
  name: string;
  carrier: string;
  type: string;
  address: {
    street: string;
    house_number?: string;
    city: string;
    postal_code: string;
    country: string;
  };
}

interface BankTransferRequest {
  tenant_id: string;
  items: CartItem[];
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: BillingAddress;
  billing_address?: BillingAddress;
  shipping_method_id?: string;
  shipping_cost?: number;
  delivery_type?: 'home_delivery' | 'service_point';
  service_point_id?: string;
  service_point_data?: ServicePointData;
  customer_id?: string;
  customer_type?: 'b2b' | 'b2c';
  vat_number?: string;
  company_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body: BankTransferRequest = await req.json();
    const { 
      tenant_id, 
      items, 
      customer_email, 
      customer_name, 
      customer_phone,
      shipping_address,
      billing_address,
      shipping_method_id,
      shipping_cost = 0,
      delivery_type = 'home_delivery',
      service_point_id,
      service_point_data,
      customer_id,
      customer_type = 'b2c',
      vat_number,
      company_name,
    } = body;

    if (!tenant_id) throw new Error("tenant_id is required");
    if (!items || items.length === 0) throw new Error("items are required");
    if (!customer_email) throw new Error("customer_email is required");

    // Validate quantities
    for (const item of items) {
      if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error(`Invalid item: product_id and quantity >= 1 are required`);
      }
    }
    logStep("Request validated", { tenant_id, itemCount: items.length });

    // SERVER-SIDE PRICE VALIDATION: Fetch actual prices from DB, ignore client-sent prices
    const productIds = items.map(i => i.product_id);
    const { data: dbProducts, error: productsError } = await supabaseClient
      .from("products")
      .select("id, name, price, sku, images")
      .in("id", productIds)
      .eq("tenant_id", tenant_id);

    if (productsError) {
      throw new Error("Failed to verify product prices");
    }

    const productMap = new Map(dbProducts.map(p => [p.id, p]));

    // Verify all products exist and belong to this tenant
    for (const item of items) {
      if (!productMap.has(item.product_id)) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
    }

    // Replace client prices with server-verified prices
    const verifiedItems = items.map(item => {
      const dbProduct = productMap.get(item.product_id)!;
      const firstImage = Array.isArray(dbProduct.images) && dbProduct.images.length > 0
        ? dbProduct.images[0] : item.product_image;
      return {
        ...item,
        unit_price: Number(dbProduct.price),
        product_name: dbProduct.name,
        product_sku: dbProduct.sku || item.product_sku,
        product_image: firstImage,
      };
    });
    logStep("Prices verified from database", {
      itemCount: verifiedItems.length,
      verifiedTotal: verifiedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    });

    // Get tenant data
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select(`
        id, name, iban, bic, 
        tax_percentage, currency, country,
        oss_enabled, oss_threshold_reached,
        reverse_charge_text, export_text,
        enable_b2b_checkout, simplified_vat_mode,
        default_vat_handling
      `)
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.iban) {
      throw new Error("Tenant has not configured bank details (IBAN) for bank transfers");
    }
    logStep("Tenant verified", { 
      tenantName: tenant.name, 
      iban: tenant.iban ? `${tenant.iban.slice(0, 8)}...` : null,
    });

    // Determine customer country
    let customerCountry = tenant.country || 'BE';
    if (billing_address?.country) {
      customerCountry = billing_address.country;
    } else if (shipping_address?.country) {
      customerCountry = shipping_address.country;
    }
    customerCountry = customerCountry.toUpperCase();

    // Calculate subtotal using verified prices
    const subtotal = verifiedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    // Calculate VAT (simplified - standard rate)
    const tenantCountry = tenant.country?.toUpperCase() || 'BE';
    const defaultVatRate = tenant.tax_percentage || EU_VAT_RATES[tenantCountry] || 21;
    
    let vatRate = defaultVatRate;
    let vatType = 'standard';
    let vatText: string | null = null;

    const isEuCountry = EU_COUNTRIES.includes(customerCountry);
    const isSameCountry = tenantCountry === customerCountry;

    // Simplified VAT logic
    if (!isSameCountry && !isEuCountry) {
      // Export
      vatRate = 0;
      vatType = 'export';
      vatText = tenant.export_text || 'Export levering - vrijgesteld van BTW';
    } else if (!isSameCountry && customer_type === 'b2b' && vat_number) {
      // B2B reverse charge (assume valid for simplicity)
      vatRate = 0;
      vatType = 'reverse_charge';
      vatText = tenant.reverse_charge_text || 'BTW verlegd naar afnemer';
    }

    const totalAmount = subtotal + shipping_cost;

    // Determine VAT handling mode: 'inclusive' means prices already contain VAT
    const vatHandling = (tenant as any).default_vat_handling || 'inclusive';

    // Per-line VAT resolution. For reverse_charge and export, ALL lines go to 0% regardless of product setting.
    const effectiveTenantRate = (vatType === 'reverse_charge' || vatType === 'export') ? 0 : vatRate;

    const vatMap = await resolveLineVatBatch(
      supabaseClient,
      verifiedItems.map((i: any) => i.product_id),
      effectiveTenantRate
    );

    const enrichedItems = verifiedItems.map((item: any) => {
      const lineGross = (item.unit_price || 0) * (item.quantity || 0);
      const { vat_rate, vat_rate_id } = (vatType === 'reverse_charge' || vatType === 'export')
        ? { vat_rate: 0, vat_rate_id: null }
        : resolveLineVatSync(item.product_id, vatMap, effectiveTenantRate);
      return { item, vat_rate, vat_rate_id, lineGross, lineVatAmount: 0 };
    });

    let vatAmount = 0;
    let total: number;

    if (vatHandling === 'inclusive') {
      const linesVat = enrichedItems.reduce((s: number, e: any) =>
        s + extractVatFromGross(e.lineGross, e.vat_rate), 0);
      const shippingVat = extractVatFromGross(shipping_cost, effectiveTenantRate);
      vatAmount = Math.round((linesVat + shippingVat) * 100) / 100;
      total = totalAmount;
      logStep("Inclusive VAT - extracted per line", { linesVat, shippingVat, vatAmount, total });
    } else {
      const linesVat = enrichedItems.reduce((s: number, e: any) =>
        s + (e.lineGross * (e.vat_rate / 100)), 0);
      const shippingVat = shipping_cost * (effectiveTenantRate / 100);
      vatAmount = Math.round((linesVat + shippingVat) * 100) / 100;
      total = Math.round((totalAmount + vatAmount) * 100) / 100;
      logStep("Exclusive VAT - added per line", { linesVat, shippingVat, vatAmount, total });
    }

    // Persist per-line VAT amount for order_items insert
    for (const e of enrichedItems) {
      e.lineVatAmount = (vatHandling === 'inclusive')
        ? extractVatFromGross(e.lineGross, e.vat_rate)
        : e.lineGross * (e.vat_rate / 100);
    }

    logStep("Totals calculated", { subtotal, shipping_cost, vatAmount, total, vatHandling });

    // Generate order number
    const { data: orderNumberData } = await supabaseClient.rpc('generate_order_number', { 
      _tenant_id: tenant_id 
    });
    const orderNumber = orderNumberData || `#${Date.now()}`;
    logStep("Order number generated", { orderNumber });

    // Generate OGM reference from order number
    const orderNumberDigits = orderNumber.replace(/\D/g, '');
    const ogmReference = generateOGM(orderNumberDigits || Date.now().toString());
    logStep("OGM reference generated", { ogmReference });

    // Determine effective shipping address
    const effectiveShippingAddress = delivery_type === 'service_point' && service_point_data
      ? {
          street: `${service_point_data.address.street}${service_point_data.address.house_number ? ' ' + service_point_data.address.house_number : ''}`,
          city: service_point_data.address.city,
          postal_code: service_point_data.address.postal_code,
          country: service_point_data.address.country,
        }
      : shipping_address;

    // Create order with pending payment status
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        tenant_id,
        order_number: orderNumber,
        customer_id,
        customer_email,
        customer_name: company_name || customer_name,
        customer_phone,
        shipping_address: effectiveShippingAddress,
        billing_address: billing_address || effectiveShippingAddress,
        subtotal,
        tax_amount: vatAmount,
        shipping_cost,
        total,
        status: "pending",
        payment_status: "pending",
        payment_method: "bank_transfer",
        shipping_method_id,
        delivery_type,
        service_point_id,
        service_point_data,
        vat_type: vatType,
        vat_rate: vatRate,
        vat_country: customerCountry,
        vat_text: vatText,
        customer_vat_number: vat_number || null,
        ogm_reference: ogmReference,
      })
      .select()
      .single();

    if (orderError) {
      logStep("Error creating order", { error: orderError.message });
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
    logStep("Order created", { orderId: order.id });

    // Create order items with per-line VAT snapshot
    const orderItems = enrichedItems.map((e: any) => ({
      order_id: order.id,
      product_id: e.item.product_id,
      product_name: e.item.product_name,
      product_sku: e.item.product_sku,
      product_image: e.item.product_image,
      quantity: e.item.quantity,
      unit_price: e.item.unit_price,
      total_price: e.item.unit_price * e.item.quantity,
      vat_rate: e.vat_rate,
      vat_rate_id: e.vat_rate_id,
      vat_amount: Math.round(e.lineVatAmount * 100) / 100,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      logStep("Error creating order items", { error: itemsError.message });
      // Don't throw - order is created
    }

    // Record transaction (for usage tracking)
    try {
      await supabaseClient.rpc('record_transaction', {
        p_tenant_id: tenant_id,
        p_transaction_type: 'bank_transfer',
        p_order_id: order.id,
      });
      logStep("Transaction recorded");
    } catch (txError) {
      logStep("Warning: Failed to record transaction", { error: String(txError) });
    }

    // Return order with bank details for QR code
    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        order_number: orderNumber,
        total,
        currency: tenant.currency || 'EUR',
        status: order.status,
        payment_status: order.payment_status,
      },
      bank_details: {
        iban: tenant.iban,
        bic: tenant.bic,
        beneficiary_name: tenant.name,
        ogm_reference: ogmReference,
        amount: total,
        currency: tenant.currency || 'EUR',
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
