import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      tenant_id,
      platform, // 'facebook' or 'instagram'
      recipient_id, // PSID for Facebook, IGSID for Instagram
      page_id, // The page/account to send from
      message,
      customer_id,
      order_id,
      quote_id,
    } = await req.json();

    if (!tenant_id || !platform || !recipient_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenant_id, platform, recipient_id, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the connection for this tenant and platform
    let query = supabase
      .from('meta_messaging_connections')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('platform', platform)
      .eq('is_active', true);

    if (page_id) {
      query = query.eq('page_id', page_id);
    }

    const { data: connection, error: connectionError } = await query.maybeSingle();

    if (connectionError || !connection) {
      console.error('No active connection found:', connectionError);
      return new Response(
        JSON.stringify({ error: `No active ${platform} connection found` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send message via Meta Graph API
    // For Facebook Messenger: POST /{page-id}/messages
    // For Instagram: POST /{instagram-account-id}/messages
    const sendEndpoint = platform === 'instagram' 
      ? `${GRAPH_API_BASE}/${connection.instagram_account_id}/messages`
      : `${GRAPH_API_BASE}/${connection.page_id}/messages`;

    const messagePayload = {
      recipient: { id: recipient_id },
      message: { text: message },
      messaging_type: 'RESPONSE', // or 'UPDATE' or 'MESSAGE_TAG' if outside 24h window
    };

    console.log(`Sending ${platform} message to:`, recipient_id);
    console.log('Endpoint:', sendEndpoint);

    const response = await fetch(sendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${connection.page_access_token}`,
      },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();
    console.log('Meta API response:', result);

    if (!response.ok) {
      console.error('Meta API error:', result);
      
      // Store failed message for retry
      await supabase.from('customer_messages').insert({
        tenant_id,
        customer_id,
        order_id,
        quote_id,
        direction: 'outbound',
        channel: platform,
        subject: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} bericht`,
        body_html: message,
        body_text: message,
        from_email: connection.page_id,
        to_email: recipient_id,
        status: 'failed',
        error_message: result.error?.message || 'Unknown error',
        meta_sender_id: recipient_id,
        meta_page_id: connection.page_id,
        context_type: 'general',
      });

      return new Response(
        JSON.stringify({ error: result.error?.message || 'Failed to send message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store successful outbound message
    const { error: insertError } = await supabase.from('customer_messages').insert({
      tenant_id,
      customer_id,
      order_id,
      quote_id,
      direction: 'outbound',
      channel: platform,
      subject: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} bericht`,
      body_html: message,
      body_text: message,
      from_email: connection.page_id,
      to_email: recipient_id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      meta_sender_id: recipient_id,
      meta_page_id: connection.page_id,
      meta_message_id: result.message_id,
      context_type: 'general',
    });

    if (insertError) {
      console.error('Error storing outbound message:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.message_id,
        recipient_id: result.recipient_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-meta-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
