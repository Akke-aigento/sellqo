import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessGiftCardPurchaseRequest {
  order_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { order_id }: ProcessGiftCardPurchaseRequest = await req.json();

    // Fetch order with items and products
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        items:order_items(
          *,
          product:products(*)
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const giftCardItems = order.items.filter(
      (item: any) => item.product?.product_type === 'gift_card'
    );

    if (giftCardItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No gift card items in order" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const createdGiftCards: string[] = [];

    for (const item of giftCardItems) {
      // Get recipient info from order item metadata or use customer info
      const recipientEmail = item.metadata?.recipient_email || order.customer?.email;
      const recipientName = item.metadata?.recipient_name || order.customer?.first_name;
      const personalMessage = item.metadata?.personal_message;
      const designId = item.metadata?.design_id || item.product?.gift_card_design_id;

      // Calculate expiry date if product has expiry months set
      let expiresAt = null;
      if (item.product?.gift_card_expiry_months) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + item.product.gift_card_expiry_months);
        expiresAt = expiry.toISOString();
      }

      // Create gift card for each quantity
      for (let i = 0; i < item.quantity; i++) {
        // Generate unique code
        const { data: code, error: codeError } = await supabaseClient.rpc('generate_gift_card_code');
        if (codeError) throw codeError;

        // Create gift card
        const { data: giftCard, error: giftCardError } = await supabaseClient
          .from("gift_cards")
          .insert({
            tenant_id: order.tenant_id,
            code,
            initial_balance: item.unit_price,
            current_balance: item.unit_price,
            currency: 'EUR',
            status: 'active',
            purchased_by_customer_id: order.customer_id,
            purchased_by_email: order.customer?.email,
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            personal_message: personalMessage,
            order_id: order_id,
            design_id: designId,
            expires_at: expiresAt,
            activated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (giftCardError) throw giftCardError;

        // Create purchase transaction
        await supabaseClient.from("gift_card_transactions").insert({
          gift_card_id: giftCard.id,
          transaction_type: 'purchase',
          amount: item.unit_price,
          balance_after: item.unit_price,
          order_id: order_id,
          description: `Aankoop via bestelling ${order.order_number}`,
        });

        // Update order item with gift card reference
        await supabaseClient
          .from("order_items")
          .update({ gift_card_id: giftCard.id })
          .eq("id", item.id);

        createdGiftCards.push(giftCard.id);

        // Send email to recipient if email is available
        if (recipientEmail) {
          try {
            const emailResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-gift-card-email`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ gift_card_id: giftCard.id }),
              }
            );

            if (!emailResponse.ok) {
              console.error("Failed to send gift card email:", await emailResponse.text());
            }
          } catch (emailError) {
            console.error("Error sending gift card email:", emailError);
          }
        }
      }
    }

    console.log(`Created ${createdGiftCards.length} gift cards for order ${order_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        created_gift_cards: createdGiftCards,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in process-gift-card-purchase:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);