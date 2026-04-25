import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveLineVatBatch, resolveLineVatSync, extractVatFromGross } from "../_shared/vat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to send payout notifications
async function sendPayoutNotification(
  supabaseClient: SupabaseClient,
  stripeAccountId: string,
  notificationType: string,
  title: string,
  message: string,
  priority: string,
  metadata: Record<string, unknown>
) {
  try {
    // Find tenant by stripe_account_id
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id")
      .eq("stripe_account_id", stripeAccountId)
      .single();

    if (tenantError || !tenant) {
      logStep("Could not find tenant for stripe account", { stripeAccountId, error: tenantError?.message });
      return;
    }

    // Send notification using RPC
    const { error: notifError } = await supabaseClient.rpc("send_notification", {
      p_tenant_id: tenant.id,
      p_category: "payments",
      p_type: notificationType,
      p_title: title,
      p_message: message,
      p_priority: priority,
      p_action_url: "/admin/payments",
      p_data: metadata,
    });

    if (notifError) {
      logStep("Error sending notification", { error: notifError.message });
    } else {
      logStep("Notification sent successfully", { type: notificationType, tenantId: tenant.id });
    }
  } catch (err) {
    logStep("Exception sending notification", { error: err instanceof Error ? err.message : String(err) });
  }
}

// Format currency amount (Stripe uses cents)
function formatAmount(amount: number, currency: string): string {
  const decimalAmount = amount / 100;
  const symbol = currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase();
  return `${symbol}${decimalAmount.toFixed(2)}`;
}

// Format date for display
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;

    // Verify webhook signature (mandatory)
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("Webhook signature verification failed", { error: message });
      return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", { 
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted
        });

        // Update tenant status based on Stripe account status
        const { error } = await supabaseClient
          .from("tenants")
          .update({
            stripe_onboarding_complete: account.details_submitted || false,
            stripe_charges_enabled: account.charges_enabled || false,
            stripe_payouts_enabled: account.payouts_enabled || false,
          })
          .eq("stripe_account_id", account.id);

        if (error) {
          logStep("Error updating tenant", { error: error.message });
        } else {
          logStep("Tenant status updated successfully");
        }
        break;
      }

      // ==================== PAYOUT EVENTS ====================
      case "payout.created": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout created", { 
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          arrivalDate: payout.arrival_date
        });

        const arrivalDate = payout.arrival_date ? formatDate(payout.arrival_date) : 'binnenkort';
        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_available',
          `Uitbetaling gepland: ${amountFormatted}`,
          `Een uitbetaling van ${amountFormatted} is gepland voor ${arrivalDate}`,
          'medium',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            arrival_date: payout.arrival_date,
          }
        );
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout paid", { 
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency
        });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_completed',
          `Uitbetaling ontvangen: ${amountFormatted}`,
          `De uitbetaling van ${amountFormatted} is succesvol op je bankrekening gestort`,
          'low',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
          }
        );
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout failed", { 
          payoutId: payout.id,
          amount: payout.amount,
          failureCode: payout.failure_code,
          failureMessage: payout.failure_message
        });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'stripe_account_issue',
          `Uitbetaling mislukt: ${amountFormatted}`,
          `De uitbetaling van ${amountFormatted} is mislukt. Reden: ${payout.failure_message || payout.failure_code || 'Onbekend'}. Controleer je bankgegevens.`,
          'urgent',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            failure_code: payout.failure_code,
            failure_message: payout.failure_message,
          }
        );
        break;
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout canceled", { payoutId: payout.id });

        const amountFormatted = formatAmount(payout.amount, payout.currency);

        await sendPayoutNotification(
          supabaseClient,
          event.account || '',
          'payout_available',
          `Uitbetaling geannuleerd: ${amountFormatted}`,
          `De geplande uitbetaling van ${amountFormatted} is geannuleerd`,
          'medium',
          {
            payout_id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            status: 'canceled',
          }
        );
        break;
      }
      // ========================================================

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        const cartId = session.metadata?.cart_id;
        const orderId = session.metadata?.order_id;

        if (cartId) {
          // NEW FLOW: Cart-based — create order from cart
          logStep("Cart-based checkout", { cartId });

          // Get cart with all checkout data
          const { data: cart, error: cartError } = await supabaseClient
            .from("storefront_carts")
            .select("*")
            .eq("id", cartId)
            .single();

          if (cartError || !cart) {
            logStep("Cart not found", { cartId, error: cartError?.message });
            break;
          }

          if (cart.checkout_status === 'converted') {
            logStep("Cart already converted, skipping", { cartId });
            break;
          }

          const tenantId = cart.tenant_id;

          // Get cart items
          const { data: cartItems } = await supabaseClient
            .from("storefront_cart_items")
            .select("id, product_id, variant_id, quantity, unit_price, products(id, name, sku, images, category_id)")
            .eq("cart_id", cartId);

          // Get variant info
          const variantIds = (cartItems || []).filter((i: any) => i.variant_id).map((i: any) => i.variant_id);
          let variantMap: Record<string, any> = {};
          if (variantIds.length > 0) {
            const { data: variants } = await supabaseClient.from("product_variants").select("id, title, sku, image_url").in("id", variantIds);
            if (variants) variantMap = Object.fromEntries(variants.map((v: any) => [v.id, v]));
          }

          const processedItems = (cartItems || []).map((item: any) => {
            const variant = item.variant_id ? variantMap[item.variant_id] : null;
            return {
              id: item.id, product_id: item.product_id, variant_id: item.variant_id || null,
              quantity: item.quantity, unit_price: item.unit_price,
              product: item.products ? { name: item.products.name, sku: variant?.sku || item.products.sku || null, image: variant?.image_url || item.products.images?.[0] || null } : null,
              variant: variant ? { title: variant.title } : null,
              line_total: item.quantity * item.unit_price,
            };
          });

          const subtotal = processedItems.reduce((s: number, i: any) => s + i.line_total, 0);

          // Get tenant
          const { data: tenant } = await supabaseClient
            .from("tenants").select("default_vat_rate, currency, name")
            .eq("id", tenantId).single();

          const tenantDefaultRate = Number(tenant?.default_vat_rate) || 21;
          const shippingCost = Number(cart.shipping_cost) || 0;
          const discountAmount = Number(cart.discount_amount) || 0;
          const total = subtotal - discountAmount + shippingCost;

          const vatMap = await resolveLineVatBatch(
            supabaseClient,
            processedItems.map((i: any) => i.product_id),
            tenantDefaultRate
          );

          const enrichedItems = processedItems.map((item: any) => {
            const lineGross = item.line_total;
            const lineDiscount = (discountAmount > 0 && subtotal > 0)
              ? (lineGross / subtotal) * discountAmount
              : 0;
            const lineNetGross = Math.max(0, lineGross - lineDiscount);
            const { vat_rate, vat_rate_id } = resolveLineVatSync(item.product_id, vatMap, tenantDefaultRate);
            const lineVatAmount = extractVatFromGross(lineNetGross, vat_rate);
            return { item, vat_rate, vat_rate_id, lineVatAmount };
          });

          const linesVatSum = enrichedItems.reduce((s: number, e: any) => s + e.lineVatAmount, 0);
          const shippingVat = extractVatFromGross(shippingCost, tenantDefaultRate);
          const vatAmount = Math.round((linesVatSum + shippingVat) * 100) / 100;

          // Find or create customer
          let customerId: string | null = null;
          if (cart.customer_email) {
            const { data: existing } = await supabaseClient
              .from("customers").select("id")
              .eq("tenant_id", tenantId).eq("email", cart.customer_email).maybeSingle();
            if (existing) {
              customerId = existing.id;
            } else {
              const { data: newCust } = await supabaseClient
                .from("customers")
                .insert({ tenant_id: tenantId, email: cart.customer_email, first_name: cart.customer_first_name || '', last_name: cart.customer_last_name || '', phone: cart.customer_phone || null, customer_type: 'consumer' })
                .select("id").single();
              customerId = newCust?.id || null;
            }
          }

          // Generate order number
          const { data: orderNumber } = await supabaseClient.rpc("generate_order_number", { _tenant_id: tenantId });

          // Create order
          const { data: newOrder, error: orderCreateError } = await supabaseClient
            .from("orders")
            .insert({
              tenant_id: tenantId,
              order_number: orderNumber,
              status: "processing",
              payment_status: "paid",
              payment_method: cart.payment_method || "stripe",
              subtotal,
              tax_amount: vatAmount,
              shipping_cost: shippingCost,
              discount_amount: discountAmount,
              discount_code: cart.discount_code || null,
              total,
              customer_email: cart.customer_email,
              customer_name: `${cart.customer_first_name || ''} ${cart.customer_last_name || ''}`.trim(),
              customer_phone: cart.customer_phone || null,
              customer_id: customerId,
              shipping_address: cart.shipping_address || null,
              billing_address: cart.billing_address || cart.shipping_address || null,
              shipping_method_id: cart.shipping_method_id || null,
              currency: cart.currency || tenant?.currency || "EUR",
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_checkout_session_id: session.id,
            })
            .select("id, order_number, total").single();

          if (orderCreateError) {
            logStep("Error creating order from cart", { error: orderCreateError.message });
            break;
          }

          logStep("Order created from cart", { orderId: newOrder.id, orderNumber: newOrder.order_number });

          // Create order items with per-line VAT snapshot
          const orderItems = enrichedItems.map(({ item, vat_rate, vat_rate_id, lineVatAmount }: any) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            product_name: item.product?.name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.line_total,
            product_sku: item.product?.sku || null,
            product_image: item.product?.image || null,
            variant_id: item.variant_id || null,
            variant_title: item.variant?.title || null,
            vat_rate,
            vat_rate_id,
            vat_amount: Math.round(lineVatAmount * 100) / 100,
          }));
          await supabaseClient.from("order_items").insert(orderItems);

          // Mark cart as converted
          await supabaseClient.from("storefront_carts").update({
            checkout_status: "converted",
            updated_at: new Date().toISOString(),
          }).eq("id", cartId);

          // Decrement stock
          for (const item of processedItems) {
            if (item.variant_id) {
              const { error: varStockErr } = await supabaseClient.rpc("decrement_variant_stock", { p_variant_id: item.variant_id, p_quantity: item.quantity });
              if (varStockErr) console.warn("Failed to decrement variant stock:", varStockErr.message);
            } else if (item.product_id) {
              const { error: prodStockErr } = await supabaseClient.rpc("decrement_stock", { p_product_id: item.product_id, p_quantity: item.quantity });
              if (prodStockErr) console.warn("Failed to decrement product stock:", prodStockErr.message);
            }
          }
          logStep("Stock updated for order items");

          // Record transaction
          try {
            await supabaseClient.rpc("record_transaction", { p_tenant_id: tenantId, p_transaction_type: "stripe", p_order_id: newOrder.id });
            logStep("Transaction recorded");
          } catch (txError) {
            logStep("Warning: Failed to record transaction", { error: String(txError) });
          }

          // Generate invoice
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const invoiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ order_id: newOrder.id }),
            });
            const invoiceResult = await invoiceResponse.json();
            logStep("Invoice generation result", invoiceResult);

            if (invoiceResult.success && invoiceResult.auto_send && invoiceResult.invoice_id) {
              await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ invoice_id: invoiceResult.invoice_id }),
              });
            }
          } catch (invoiceError) {
            logStep("Invoice generation error (non-blocking)", { error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError) });
          }

          // Send order confirmation email (non-blocking)
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            await fetch(`${supabaseUrl}/functions/v1/send-order-confirmation`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ order_id: newOrder.id }),
            });
          } catch (e) {
            logStep("Order confirmation email error (non-blocking)", { error: e instanceof Error ? e.message : String(e) });
          }

          // Admin notification for new storefront order (non-blocking)
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const totalFormatted = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: tenant?.currency || 'EUR' }).format(Number(newOrder.total) || 0);
            await fetch(`${supabaseUrl}/functions/v1/create-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({
                tenant_id: tenantId,
                category: 'orders',
                type: 'storefront_order_new',
                title: `Nieuwe bestelling: ${newOrder.order_number}`,
                message: `${cart.customer_first_name || 'Klant'} ${cart.customer_last_name || ''} — ${totalFormatted}`.trim(),
                priority: 'medium',
                action_url: `/admin/orders/${newOrder.id}`,
                data: { order_id: newOrder.id, order_number: newOrder.order_number, total: newOrder.total },
              }),
            });
          } catch (e) {
            logStep("Admin notification error (non-blocking)", { error: e instanceof Error ? e.message : String(e) });
          }

        } else if (orderId) {
          // LEGACY FLOW: Order-based (backward compat for old sessions)
          logStep("Legacy order-based checkout", { orderId });

          const { data: orderData } = await supabaseClient
            .from("orders").select("tenant_id").eq("id", orderId).single();

          const { error } = await supabaseClient
            .from("orders")
            .update({ payment_status: "paid", status: "processing", stripe_payment_intent_id: session.payment_intent as string })
            .eq("id", orderId);

          if (error) {
            logStep("Error updating order", { error: error.message });
          } else {
            logStep("Order updated to paid", { orderId });
            if (orderData?.tenant_id) {
              try {
                await supabaseClient.rpc("record_transaction", { p_tenant_id: orderData.tenant_id, p_transaction_type: "stripe", p_order_id: orderId });
              } catch (txError) {
                logStep("Warning: Failed to record transaction", { error: String(txError) });
              }
            }
          }

          // Update stock
          const { data: orderItems } = await supabaseClient
            .from("order_items").select("product_id, quantity").eq("order_id", orderId);
          if (orderItems) {
            for (const item of orderItems) {
              if (item.product_id) {
                await supabaseClient.rpc("decrement_stock", { p_product_id: item.product_id, p_quantity: item.quantity });
              }
            }
          }

          // Generate invoice
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const invoiceResponse = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ order_id: orderId }),
            });
            const invoiceResult = await invoiceResponse.json();
            if (invoiceResult.success && invoiceResult.auto_send && invoiceResult.invoice_id) {
              await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ invoice_id: invoiceResult.invoice_id }),
              });
            }
          } catch (invoiceError) {
            logStep("Invoice generation error (non-blocking)", { error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError) });
          }

          // Send order confirmation email (non-blocking) — legacy path
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            await fetch(`${supabaseUrl}/functions/v1/send-order-confirmation`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ order_id: orderId }),
            });
          } catch (e) {
            logStep("Order confirmation email error (non-blocking)", { error: e instanceof Error ? e.message : String(e) });
          }
        } else {
          logStep("No cart_id or order_id in session metadata");
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent succeeded", { 
          paymentIntentId: paymentIntent.id,
          orderId: paymentIntent.metadata?.order_id 
        });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabaseClient
            .from("orders")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq("id", orderId);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent failed", { paymentIntentId: paymentIntent.id });

        const orderId = paymentIntent.metadata?.order_id;
        if (orderId) {
          await supabaseClient
            .from("orders")
            .update({
              payment_status: "failed",
            })
            .eq("id", orderId);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
