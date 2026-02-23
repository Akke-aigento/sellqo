import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

// Platform fee percentage (e.g., 5%)
const PLATFORM_FEE_PERCENT = 5;

// EU country codes for VAT determination
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// EU VAT rates by country (standard rates)
const EU_VAT_RATES: Record<string, number> = {
  'AT': 20, 'BE': 21, 'BG': 20, 'HR': 25, 'CY': 19, 'CZ': 21,
  'DK': 25, 'EE': 22, 'FI': 25.5, 'FR': 20, 'DE': 19, 'GR': 24,
  'HU': 27, 'IE': 23, 'IT': 22, 'LV': 21, 'LT': 21, 'LU': 17,
  'MT': 18, 'NL': 21, 'PL': 23, 'PT': 23, 'RO': 19, 'SK': 20,
  'SI': 22, 'ES': 21, 'SE': 25
};

interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
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
  distance?: number;
  latitude?: number;
  longitude?: number;
  opening_hours?: Record<string, string>;
}

interface BillingAddress {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface CheckoutRequest {
  tenant_id: string;
  items: CartItem[];
  customer_email: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  billing_address?: BillingAddress;
  shipping_method_id?: string;
  shipping_cost?: number;
  // Service point fields
  delivery_type?: 'home_delivery' | 'service_point';
  service_point_id?: string;
  service_point_data?: ServicePointData;
  // NEW: Customer type and VAT fields for proper tax calculation
  customer_id?: string;
  customer_type?: 'b2b' | 'b2c';
  vat_number?: string;
  company_name?: string;
}

interface VatCalculation {
  vatRate: number;
  vatAmount: number;
  vatType: 'standard' | 'reverse_charge' | 'export' | 'oss' | 'exempt';
  vatText: string | null;
  vatCountry: string;
}

interface TenantData {
  id: string;
  name: string;
  stripe_account_id: string;
  stripe_charges_enabled: boolean;
  tax_percentage: number | null;
  currency: string | null;
  country: string | null;
  oss_enabled: boolean | null;
  oss_threshold_reached: boolean | null;
  reverse_charge_text: string | null;
  export_text: string | null;
  enable_b2b_checkout: boolean | null;
  simplified_vat_mode: boolean | null;
}

// Validate VAT number via VIES (simplified - in production use the validate-vat function)
async function validateVatNumber(vatNumber: string): Promise<boolean> {
  try {
    // Extract country code and number
    const countryCode = vatNumber.substring(0, 2).toUpperCase();
    const number = vatNumber.substring(2).replace(/[\s.-]/g, '');
    
    if (!EU_COUNTRIES.includes(countryCode)) {
      return false;
    }
    
    // Call VIES API
    const response = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode,
          vatNumber: number,
        }),
      }
    );
    
    if (!response.ok) {
      logStep("VIES API error", { status: response.status });
      return false;
    }
    
    const result = await response.json();
    return result.valid === true;
  } catch (error) {
    logStep("VIES validation error", { error: String(error) });
    return false;
  }
}

// Calculate VAT based on customer type, location, and VAT number
async function calculateVat(params: {
  subtotal: number;
  shippingCost: number;
  tenant: TenantData;
  customerType: 'b2b' | 'b2c';
  customerCountry: string;
  vatNumber?: string;
}): Promise<VatCalculation> {
  const { subtotal, shippingCost, tenant, customerType, customerCountry, vatNumber } = params;
  
  const tenantCountry = tenant.country?.toUpperCase() || 'BE';
  const customerCountryUpper = customerCountry.toUpperCase();
  const totalAmount = subtotal + shippingCost;
  const defaultVatRate = tenant.tax_percentage || EU_VAT_RATES[tenantCountry] || 21;
  
  // SIMPLIFIED VAT MODE: Always apply default rate, skip all complex logic
  if (tenant.simplified_vat_mode) {
    const vatAmount = Math.round(totalAmount * (defaultVatRate / 100) * 100) / 100;
    logStep("Simplified VAT mode - always default rate", { vatRate: defaultVatRate, vatAmount });
    return {
      vatRate: defaultVatRate,
      vatAmount,
      vatType: 'standard',
      vatText: null,
      vatCountry: tenantCountry,
    };
  }
  
  const isEuCountry = EU_COUNTRIES.includes(customerCountryUpper);
  const isSameCountry = tenantCountry === customerCountryUpper;
  
  logStep("VAT calculation params", {
    customerType,
    customerCountry: customerCountryUpper,
    tenantCountry,
    isEuCountry,
    isSameCountry,
    vatNumber: vatNumber ? `${vatNumber.substring(0, 4)}...` : null,
    ossEnabled: tenant.oss_enabled,
    ossThresholdReached: tenant.oss_threshold_reached,
  });
  
  // Case 1: Same country - always apply standard VAT
  if (isSameCountry) {
    const vatAmount = Math.round(totalAmount * (defaultVatRate / 100) * 100) / 100;
    logStep("Same country - standard VAT", { vatRate: defaultVatRate, vatAmount });
    return {
      vatRate: defaultVatRate,
      vatAmount,
      vatType: 'standard',
      vatText: null,
      vatCountry: tenantCountry,
    };
  }
  
  // Case 2: Export outside EU - 0% VAT
  if (!isEuCountry) {
    logStep("Export outside EU - 0% VAT");
    return {
      vatRate: 0,
      vatAmount: 0,
      vatType: 'export',
      vatText: tenant.export_text || 'Export levering - vrijgesteld van BTW (Art. 39 W.BTW)',
      vatCountry: customerCountryUpper,
    };
  }
  
  // Case 3: B2B in other EU country with valid VAT number - Reverse Charge
  if (customerType === 'b2b' && vatNumber) {
    const isValidVat = await validateVatNumber(vatNumber);
    
    if (isValidVat) {
      logStep("B2B EU with valid VAT - Reverse Charge");
      return {
        vatRate: 0,
        vatAmount: 0,
        vatType: 'reverse_charge',
        vatText: tenant.reverse_charge_text || 'BTW verlegd naar afnemer (Art. 196 BTW-richtlijn 2006/112/EG)',
        vatCountry: customerCountryUpper,
      };
    } else {
      logStep("B2B EU with invalid VAT - apply standard rate");
      // Invalid VAT number - apply seller's VAT rate
      const vatAmount = Math.round(totalAmount * (defaultVatRate / 100) * 100) / 100;
      return {
        vatRate: defaultVatRate,
        vatAmount,
        vatType: 'standard',
        vatText: 'BTW-nummer niet geldig - standaard tarief toegepast',
        vatCountry: tenantCountry,
      };
    }
  }
  
  // Case 4: B2C in other EU country - OSS rules
  if (customerType === 'b2c' && tenant.oss_enabled && tenant.oss_threshold_reached) {
    // Apply destination country VAT rate (OSS)
    const destinationVatRate = EU_VAT_RATES[customerCountryUpper] || defaultVatRate;
    const vatAmount = Math.round(totalAmount * (destinationVatRate / 100) * 100) / 100;
    logStep("B2C EU - OSS destination rate", { destinationVatRate, vatAmount });
    return {
      vatRate: destinationVatRate,
      vatAmount,
      vatType: 'oss',
      vatText: `OSS-regeling - BTW-tarief ${customerCountryUpper}: ${destinationVatRate}%`,
      vatCountry: customerCountryUpper,
    };
  }
  
  // Case 5: Default - apply seller's standard VAT rate
  const vatAmount = Math.round(totalAmount * (defaultVatRate / 100) * 100) / 100;
  logStep("Default - seller's VAT rate", { vatRate: defaultVatRate, vatAmount });
  return {
    vatRate: defaultVatRate,
    vatAmount,
    vatType: 'standard',
    vatText: null,
    vatCountry: tenantCountry,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body: CheckoutRequest = await req.json();
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
      // NEW VAT fields
      customer_id,
      customer_type = 'b2c',
      vat_number,
      company_name,
    } = body;

    if (!tenant_id) throw new Error("tenant_id is required");
    if (!items || items.length === 0) throw new Error("items are required");
    if (!customer_email) throw new Error("customer_email is required");
    logStep("Request validated", { tenant_id, itemCount: items.length, customerType: customer_type });

    // Get tenant data with Stripe account and VAT settings
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select(`
        id, name, slug, stripe_account_id, stripe_charges_enabled, 
        tax_percentage, currency, country,
        oss_enabled, oss_threshold_reached,
        reverse_charge_text, export_text,
        enable_b2b_checkout, simplified_vat_mode
      `)
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.stripe_account_id) {
      throw new Error("Tenant has not configured payments yet");
    }

    if (!tenant.stripe_charges_enabled) {
      throw new Error("Tenant payment account is not fully activated");
    }
    logStep("Tenant verified", { 
      tenantName: tenant.name, 
      tenantSlug: tenant.slug,
      stripeAccountId: tenant.stripe_account_id,
      tenantCountry: tenant.country,
      ossEnabled: tenant.oss_enabled,
      enableB2bCheckout: tenant.enable_b2b_checkout,
      simplifiedVatMode: tenant.simplified_vat_mode,
    });

    // Apply B2B checkout setting - force B2C if B2B is disabled
    const effectiveCustomerType = tenant.enable_b2b_checkout === false 
      ? 'b2c' 
      : customer_type;
    
    const effectiveVatNumber = tenant.enable_b2b_checkout === false
      ? undefined
      : vat_number;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Determine customer country for VAT calculation
    // Priority: billing_address > shipping_address > service_point_data > tenant default
    let customerCountry = tenant.country || 'BE';
    if (billing_address?.country) {
      customerCountry = billing_address.country;
    } else if (shipping_address?.country) {
      customerCountry = shipping_address.country;
    } else if (service_point_data?.address?.country) {
      customerCountry = service_point_data.address.country;
    }
    
    logStep("Customer country determined", { customerCountry, source: billing_address ? 'billing' : shipping_address ? 'shipping' : 'default' });

    // Calculate subtotal (in currency units, not cents)
    const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    
    // Calculate VAT based on customer type and location (using effective values after B2B check)
    const vatCalculation = await calculateVat({
      subtotal,
      shippingCost: shipping_cost,
      tenant: tenant as TenantData,
      customerType: effectiveCustomerType,
      customerCountry,
      vatNumber: effectiveVatNumber,
    });
    
    logStep("VAT calculated", {
      vatType: vatCalculation.vatType,
      vatRate: vatCalculation.vatRate,
      vatAmount: vatCalculation.vatAmount,
      vatCountry: vatCalculation.vatCountry,
    });

    // Calculate totals (convert to cents for Stripe)
    const subtotalCents = Math.round(subtotal * 100);
    const shippingCents = Math.round(shipping_cost * 100);
    const vatCents = Math.round(vatCalculation.vatAmount * 100);
    const totalCents = subtotalCents + shippingCents + vatCents;

    // Calculate platform fee (in cents)
    const platformFee = Math.round(totalCents * (PLATFORM_FEE_PERCENT / 100));
    logStep("Totals calculated", { 
      subtotalCents, 
      shippingCents, 
      vatCents, 
      totalCents, 
      platformFee 
    });

    // Create line items for Stripe Checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
      price_data: {
        currency: tenant.currency?.toLowerCase() || "eur",
        product_data: {
          name: item.product_name,
          images: item.product_image ? [item.product_image] : undefined,
        },
        unit_amount: Math.round(item.unit_price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item if present
    if (shipping_cost > 0) {
      lineItems.push({
        price_data: {
          currency: tenant.currency?.toLowerCase() || "eur",
          product_data: {
            name: "Verzendkosten",
          },
          unit_amount: shippingCents,
        },
        quantity: 1,
      });
    }

    // Add VAT as a separate line item if applicable
    if (vatCents > 0) {
      lineItems.push({
        price_data: {
          currency: tenant.currency?.toLowerCase() || "eur",
          product_data: {
            name: `BTW (${vatCalculation.vatRate}%)`,
          },
          unit_amount: vatCents,
        },
        quantity: 1,
      });
    }

    // Generate order number
    const { data: orderNumberData } = await supabaseClient.rpc('generate_order_number', { 
      _tenant_id: tenant_id 
    });
    const orderNumber = orderNumberData || `#${Date.now()}`;
    logStep("Order number generated", { orderNumber });

    // Determine effective shipping address (use service point address if selected)
    const effectiveShippingAddress = delivery_type === 'service_point' && service_point_data
      ? {
          street: `${service_point_data.address.street}${service_point_data.address.house_number ? ' ' + service_point_data.address.house_number : ''}`,
          city: service_point_data.address.city,
          postal_code: service_point_data.address.postal_code,
          country: service_point_data.address.country,
        }
      : shipping_address;

    // Create pending order in database with VAT details
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
        subtotal: subtotal,
        tax_amount: vatCalculation.vatAmount,
        shipping_cost: shipping_cost,
        total: subtotal + shipping_cost + vatCalculation.vatAmount,
        status: "pending",
        payment_status: "pending",
        shipping_method_id,
        delivery_type,
        service_point_id,
        service_point_data,
        // NEW VAT fields (using effective values)
        vat_type: vatCalculation.vatType,
        vat_rate: vatCalculation.vatRate,
        vat_country: vatCalculation.vatCountry,
        vat_text: vatCalculation.vatText,
        customer_vat_number: effectiveVatNumber || null,
        customer_vat_verified: effectiveVatNumber ? (vatCalculation.vatType === 'reverse_charge') : false,
        customer_company_name: tenant.enable_b2b_checkout === false ? null : (company_name || null),
        customer_type: effectiveCustomerType,
      })
      .select()
      .single();

    if (orderError) {
      logStep("Error creating order", { error: orderError.message });
      throw new Error(`Failed to create order: ${orderError.message}`);
    }
    logStep("Order created", { 
      orderId: order.id, 
      deliveryType: delivery_type,
      vatType: vatCalculation.vatType,
      customerType: effectiveCustomerType,
    });

    // Create order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      product_image: item.product_image,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
    }));

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      logStep("Error creating order items", { error: itemsError.message });
    }

    // Create Stripe Checkout Session with destination charge
    const origin = req.headers.get("origin") || "https://id-preview--9932a7fe-43a1-42de-9c64-168968599600.lovable.app";
    const tenantSlug = tenant.slug || tenant_id;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'ideal', 'bancontact'],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/shop/${tenantSlug}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop/${tenantSlug}/checkout?cancelled=true`,
      customer_email,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: tenant.stripe_account_id,
        },
        metadata: {
          order_id: order.id,
          tenant_id,
          order_number: orderNumber,
          vat_type: vatCalculation.vatType,
          vat_rate: String(vatCalculation.vatRate),
          customer_type,
        },
      },
      metadata: {
        order_id: order.id,
        tenant_id,
        order_number: orderNumber,
        vat_type: vatCalculation.vatType,
        customer_type,
      },
    });
    logStep("Checkout session created", { sessionId: session.id });

    // Update order with checkout session ID
    await supabaseClient
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id,
      order_id: order.id,
      order_number: orderNumber,
      vat_calculation: {
        type: vatCalculation.vatType,
        rate: vatCalculation.vatRate,
        amount: vatCalculation.vatAmount,
        text: vatCalculation.vatText,
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
      status: 500,
    });
  }
});
