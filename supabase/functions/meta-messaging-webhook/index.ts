import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    console.log('Meta Messaging webhook verification request:', { mode, token, challenge });

    if (mode === 'subscribe' && token && challenge) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find connection with matching verify token
      const { data: connection } = await supabase
        .from('meta_messaging_connections')
        .select('id')
        .eq('webhook_verify_token', token)
        .maybeSingle();

      if (connection) {
        console.log('Meta Messaging webhook verified successfully');
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
      console.log('Meta Messaging webhook received:', JSON.stringify(body, null, 2));

      // Determine platform from object type
      const objectType = body.object; // 'page' for Facebook, 'instagram' for Instagram
      const platform = objectType === 'instagram' ? 'instagram' : 'facebook';

      const entries = body.entry || [];
      for (const entry of entries) {
        const pageId = entry.id; // Page ID for Facebook, Instagram Account ID for Instagram

        // Find the tenant connection by page_id
        const { data: connection, error: connectionError } = await supabase
          .from('meta_messaging_connections')
          .select('tenant_id, page_name, page_id, instagram_account_id')
          .eq(platform === 'instagram' ? 'instagram_account_id' : 'page_id', pageId)
          .eq('platform', platform)
          .eq('is_active', true)
          .maybeSingle();

        if (connectionError || !connection) {
          console.error(`No ${platform} connection found for ID:`, pageId);
          continue;
        }

        // Process messaging events
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          const senderId = event.sender?.id;
          const recipientId = event.recipient?.id;
          const timestamp = event.timestamp;

          // Handle incoming message
          if (event.message) {
            const message = event.message;
            const messageId = message.mid;
            let messageText = '';

            if (message.text) {
              messageText = message.text;
            } else if (message.attachments) {
              const attachmentTypes = message.attachments.map((a: any) => a.type).join(', ');
              messageText = `[${attachmentTypes} attachment]`;
            } else if (message.sticker_id) {
              messageText = '[Sticker]';
            } else {
              messageText = '[Media message]';
            }

            // Try to find customer by platform ID
            const customerColumn = platform === 'instagram' ? 'instagram_id' : 'facebook_psid';
            const { data: customer } = await supabase
              .from('customers')
              .select('id, first_name, last_name, email')
              .eq('tenant_id', connection.tenant_id)
              .eq(customerColumn, senderId)
              .maybeSingle();

            // Create prospect if customer not found
            let customerId = customer?.id || null;
            if (!customerId) {
              const insertData: Record<string, unknown> = {
                tenant_id: connection.tenant_id,
                customer_type: 'prospect',
                notes: `Automatisch aangemaakt vanuit ${platform === 'instagram' ? 'Instagram' : 'Facebook Messenger'} inbox`,
                total_orders: 0,
                total_spent: 0,
              };

              // Platform-specific identifier
              if (platform === 'instagram') {
                insertData.instagram_id = senderId;
              } else {
                insertData.facebook_psid = senderId;
              }

              const { data: newProspect } = await supabase
                .from('customers')
                .insert(insertData)
                .select('id')
                .single();

              if (newProspect) {
                customerId = newProspect.id;
                console.log(`Created ${platform} prospect: ${senderId}`);
              }
            }

            // Store inbound message
            const { error: insertError } = await supabase.from('customer_messages').insert({
              tenant_id: connection.tenant_id,
              customer_id: customerId,
              direction: 'inbound',
              channel: platform,
              subject: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} bericht`,
              body_html: messageText,
              body_text: messageText,
              from_email: senderId,
              to_email: recipientId,
              status: 'delivered',
              delivered_at: new Date(timestamp).toISOString(),
              meta_sender_id: senderId,
              meta_page_id: connection.page_id,
              meta_message_id: messageId,
              context_type: 'general',
            });

            if (insertError) {
              console.error('Error storing message:', insertError);
            }

            // Create notification
            const senderName = customer 
              ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || senderId
              : senderId;

            await supabase.from('notifications').insert({
              tenant_id: connection.tenant_id,
              category: 'messages',
              type: `${platform}_inbound`,
              title: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} bericht ontvangen`,
              message: `${senderName}: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`,
              priority: 'medium',
              action_url: '/admin/messages',
              data: {
                sender_id: senderId,
                customer_id: customer?.id,
                message_preview: messageText.substring(0, 200),
                platform,
              },
            });

            console.log(`${platform} inbound message stored:`, { from: senderId, text: messageText });
          }

          // Handle message read event
          if (event.read) {
            const watermark = event.read.watermark;
            console.log(`Messages read up to watermark: ${watermark}`);
            // Could update read status for messages before this watermark
          }

          // Handle message delivery event
          if (event.delivery) {
            const mids = event.delivery.mids || [];
            for (const mid of mids) {
              await supabase
                .from('customer_messages')
                .update({
                  status: 'delivered',
                  delivered_at: new Date().toISOString(),
                })
                .eq('meta_message_id', mid);
            }
            console.log('Delivery confirmed for messages:', mids);
          }

          // Handle postback (button clicks)
          if (event.postback) {
            const payload = event.postback.payload;
            const title = event.postback.title;
            console.log('Postback received:', { payload, title });

            // Store as a message
            await supabase.from('customer_messages').insert({
              tenant_id: connection.tenant_id,
              direction: 'inbound',
              channel: platform,
              subject: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} knop geklikt`,
              body_html: `[Button: ${title}]`,
              body_text: `[Button: ${title}]`,
              from_email: senderId,
              to_email: recipientId,
              status: 'delivered',
              delivered_at: new Date(timestamp).toISOString(),
              meta_sender_id: senderId,
              meta_page_id: connection.page_id,
              context_type: 'general',
              context_data: { postback_payload: payload },
            });
          }
        }
      }

      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Meta Messaging webhook processing error:', error);
      return new Response('OK', { status: 200 }); // Always return 200 to Meta
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
