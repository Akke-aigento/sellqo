import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, tenant_id, items } = await req.json();

    if (!order_id || !tenant_id || !items?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = [];

    for (const item of items) {
      const meta = item.gift_card_metadata;
      if (!meta) continue;

      // Generate unique code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_gift_card_code');
      if (codeError) {
        console.error('Code generation error:', codeError);
        continue;
      }

      const code = codeData as string;
      const amount = item.unit_price * item.quantity;

      // Calculate expiry if configured
      let expiresAt: string | null = null;
      if (meta.expiry_months) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + meta.expiry_months);
        expiresAt = expiry.toISOString();
      }

      // Create gift card
      const { data: giftCard, error: gcError } = await supabase
        .from('gift_cards')
        .insert({
          tenant_id,
          code,
          initial_balance: amount,
          current_balance: amount,
          currency: 'EUR',
          status: 'active',
          purchased_by_email: meta.purchaser_email || null,
          recipient_email: meta.recipientEmail || null,
          recipient_name: meta.recipientName || null,
          personal_message: meta.personalMessage || null,
          design_id: meta.designId || null,
          order_id,
          expires_at: expiresAt,
          activated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (gcError) {
        console.error('Gift card creation error:', gcError);
        continue;
      }

      // Record purchase transaction
      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        transaction_type: 'purchase',
        amount,
        balance_after: amount,
        description: `Aankoop via bestelling ${order_id}`,
      });

      // Send email if no future send date (or send date is today/past)
      const sendDate = meta.sendDate ? new Date(meta.sendDate) : null;
      const shouldSendNow = !sendDate || sendDate <= new Date();

      if (shouldSendNow && meta.recipientEmail) {
        try {
          await supabase.functions.invoke('send-gift-card-email', {
            body: { gift_card_id: giftCard.id },
          });
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      }

      results.push({
        gift_card_id: giftCard.id,
        code: giftCard.code,
        amount,
      });
    }

    return new Response(JSON.stringify({ success: true, gift_cards: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Process gift card order error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
