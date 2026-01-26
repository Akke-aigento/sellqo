import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_API = 'https://graph.facebook.com/v18.0';

interface SendWhatsAppRequest {
  tenant_id: string;
  customer_id?: string;
  to_phone: string;
  template_type: string;
  template_name?: string;
  template_variables?: Record<string, string>;
  order_id?: string;
  quote_id?: string;
}

interface TemplateComponent {
  type: string;
  parameters?: Array<{
    type: string;
    text?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendWhatsAppRequest = await req.json();
    const { tenant_id, customer_id, to_phone, template_type, template_name, template_variables, order_id, quote_id } = body;

    if (!tenant_id || !to_phone || !template_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tenant_id, to_phone, template_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp connection for tenant
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured for this tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('template_type', template_type)
      .eq('status', 'approved')
      .maybeSingle();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: `No approved template found for type: ${template_type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build template components with variables
    const components: TemplateComponent[] = [];
    
    if (template_variables && Object.keys(template_variables).length > 0) {
      const bodyParams = Object.values(template_variables).map(value => ({
        type: 'text',
        text: value,
      }));
      
      components.push({
        type: 'body',
        parameters: bodyParams,
      });
    }

    // Format phone number (remove spaces, ensure + prefix)
    const formattedPhone = to_phone.replace(/\s/g, '').replace(/^0/, '+31');

    // Send message via WhatsApp Cloud API
    const whatsappResponse = await fetch(
      `${WHATSAPP_API}/${connection.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.access_token_encrypted}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: template_name || template.template_name,
            language: { code: template.language },
            components: components.length > 0 ? components : undefined,
          },
        }),
      }
    );

    const whatsappResult = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error:', whatsappResult);
      
      // Log failed message
      await supabase.from('customer_messages').insert({
        tenant_id,
        customer_id,
        order_id,
        quote_id,
        direction: 'outbound',
        channel: 'whatsapp',
        subject: `WhatsApp: ${template_type}`,
        body_html: template.body_text,
        body_text: template.body_text,
        from_email: connection.display_phone_number,
        to_email: to_phone,
        status: 'failed',
        error_message: whatsappResult.error?.message || 'Unknown error',
        whatsapp_status: 'failed',
      });

      return new Response(
        JSON.stringify({ error: whatsappResult.error?.message || 'Failed to send WhatsApp message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageId = whatsappResult.messages?.[0]?.id;

    // Log successful message
    await supabase.from('customer_messages').insert({
      tenant_id,
      customer_id,
      order_id,
      quote_id,
      direction: 'outbound',
      channel: 'whatsapp',
      subject: `WhatsApp: ${template_type}`,
      body_html: template.body_text,
      body_text: template.body_text,
      from_email: connection.display_phone_number,
      to_email: to_phone,
      status: 'sent',
      sent_at: new Date().toISOString(),
      whatsapp_message_id: messageId,
      whatsapp_status: 'sent',
      context_type: order_id ? 'order' : quote_id ? 'quote' : 'general',
      context_data: template_variables || {},
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageId,
        to: formattedPhone,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
