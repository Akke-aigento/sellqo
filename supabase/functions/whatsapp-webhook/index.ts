import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token && challenge) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find connection with matching verify token
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('webhook_verify_token', token)
        .maybeSingle();

      if (connection) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      }
    }

    return new Response('Forbidden', { status: 403 });
  }

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle incoming webhooks (POST request)
  if (req.method === 'POST') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const body = await req.json();
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Process WhatsApp webhook events
      const entry = body.entry?.[0];
      if (!entry) {
        return new Response('OK', { status: 200 });
      }

      const changes = entry.changes?.[0];
      if (!changes || changes.field !== 'messages') {
        return new Response('OK', { status: 200 });
      }

      const value = changes.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // Find the tenant by phone_number_id
      const { data: connection, error: connectionError } = await supabase
        .from('whatsapp_connections')
        .select('tenant_id, display_phone_number')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle();

      if (connectionError || !connection) {
        console.error('No connection found for phone_number_id:', phoneNumberId);
        return new Response('OK', { status: 200 });
      }

      // Handle incoming messages
      const messages = value.messages || [];
      for (const message of messages) {
        const fromPhone = message.from;
        const messageType = message.type;
        let messageText = '';

        if (messageType === 'text') {
          messageText = message.text?.body || '';
        } else if (messageType === 'button') {
          messageText = `[Button: ${message.button?.text}]`;
        } else if (messageType === 'interactive') {
          const interactive = message.interactive;
          if (interactive?.type === 'button_reply') {
            messageText = `[Button: ${interactive.button_reply?.title}]`;
          } else if (interactive?.type === 'list_reply') {
            messageText = `[List: ${interactive.list_reply?.title}]`;
          }
        } else {
          messageText = `[${messageType} message]`;
        }

        // Try to find customer by phone number
        const { data: customer } = await supabase
          .from('customers')
          .select('id, first_name, last_name')
          .eq('tenant_id', connection.tenant_id)
          .eq('whatsapp_number', fromPhone)
          .maybeSingle();

        // Create prospect if customer not found
        let customerId = customer?.id || null;
        if (!customerId) {
          const { data: newProspect } = await supabase
            .from('customers')
            .insert({
              tenant_id: connection.tenant_id,
              whatsapp_number: fromPhone,
              phone: fromPhone,
              customer_type: 'prospect',
              notes: 'Automatisch aangemaakt vanuit WhatsApp inbox',
              total_orders: 0,
              total_spent: 0,
            })
            .select('id')
            .single();

          if (newProspect) {
            customerId = newProspect.id;
            console.log(`Created WhatsApp prospect: ${fromPhone}`);
          }
        }

        // Store inbound message
        await supabase.from('customer_messages').insert({
          tenant_id: connection.tenant_id,
          customer_id: customerId,
          direction: 'inbound',
          channel: 'whatsapp',
          subject: `WhatsApp bericht van ${fromPhone}`,
          body_html: messageText,
          body_text: messageText,
          from_email: fromPhone,
          to_email: connection.display_phone_number,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          whatsapp_message_id: message.id,
          whatsapp_status: 'delivered',
          context_type: 'general',
        });

        // Create notification for new inbound message
        await supabase.from('notifications').insert({
          tenant_id: connection.tenant_id,
          category: 'messages',
          type: 'whatsapp_inbound',
          title: `WhatsApp bericht ontvangen`,
          message: `${customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || fromPhone : fromPhone}: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`,
          priority: 'medium',
          action_url: '/admin/messages',
          data: {
            from_phone: fromPhone,
            customer_id: customer?.id,
            message_preview: messageText.substring(0, 200),
          },
        });

        console.log('Inbound message stored:', { from: fromPhone, text: messageText });
      }

      // Handle message status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        const messageId = status.id;
        const statusValue = status.status; // sent, delivered, read, failed

        await supabase
          .from('customer_messages')
          .update({
            whatsapp_status: statusValue,
            ...(statusValue === 'delivered' && { delivered_at: new Date().toISOString() }),
            ...(statusValue === 'read' && { opened_at: new Date().toISOString() }),
          })
          .eq('whatsapp_message_id', messageId);

        console.log('Status updated:', { messageId, status: statusValue });
      }

      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response('OK', { status: 200 }); // Always return 200 to Meta
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
