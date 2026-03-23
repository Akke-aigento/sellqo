import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function validateInput(body: Record<string, unknown>) {
  const errors: string[] = [];
  
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tenantSlug = typeof body.tenant_slug === 'string' ? body.tenant_slug.trim() : '';

  if (!name || name.length > 100) errors.push('Invalid name');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) errors.push('Invalid email');
  if (!subject || subject.length > 200) errors.push('Invalid subject');
  if (!message || message.length > 5000) errors.push('Invalid message');
  if (!tenantSlug) errors.push('Missing tenant_slug');

  return { name, email, subject, message, tenantSlug, errors };
}

async function forwardEmail(
  tenantName: string,
  forwardAddress: string,
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string,
  resendApiKey: string
) {
  try {
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #333;">Nieuw contactformulier bericht</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; color: #666; width: 100px;"><strong>Van:</strong></td><td>${senderName} (${senderEmail})</td></tr>
          <tr><td style="padding: 8px 0; color: #666;"><strong>Onderwerp:</strong></td><td>${subject}</td></tr>
        </table>
        <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${message}</div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Dit bericht is doorgestuurd vanuit de ${tenantName} webshop via SellQo.</p>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${tenantName} <noreply@sellqo.app>`,
        to: [forwardAddress],
        reply_to: senderEmail,
        subject: `[Contact] ${subject}`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Forward email failed:', err);
    } else {
      console.log('Forwarded contact form to:', forwardAddress);
    }
  } catch (err) {
    console.error('Forward email error:', err);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const { name, email, subject, message, tenantSlug, errors } = validateInput(body);

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: errors.join(', ') }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, email_forward_enabled, email_forward_address")
      .eq("slug", tenantSlug)
      .maybeSingle();

    if (!tenant || tenantError) {
      return new Response(JSON.stringify({ error: "Winkel niet gevonden" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find or create customer
    let customerId: string | null = null;
    
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const nameParts = name.split(/\s+/);
      const firstName = nameParts[0] || null;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenant.id,
          email,
          first_name: firstName,
          last_name: lastName,
          customer_type: 'prospect',
          notes: 'Aangemaakt via contactformulier',
          total_orders: 0,
          total_spent: 0,
        })
        .select("id")
        .single();

      if (newCustomer) customerId = newCustomer.id;
    }

    // Store message
    const bodyHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${message}</pre>`;

    const { data: msg, error: insertError } = await supabase
      .from("customer_messages")
      .insert({
        tenant_id: tenant.id,
        customer_id: customerId,
        direction: "inbound",
        channel: "contact_form",
        subject,
        body_html: bodyHtml,
        body_text: message,
        from_email: `${name} <${email}>`,
        to_email: tenant.name,
        reply_to_email: email,
        status: "delivered",
        delivered_at: new Date().toISOString(),
        context_type: "general",
        context_data: { source: 'storefront_contact_form', sender_name: name },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to store contact message:", insertError);
      throw new Error(insertError.message);
    }

    // Create notification
    await supabase.from("notifications").insert({
      tenant_id: tenant.id,
      category: "messages",
      type: "contact_form",
      title: "Nieuw contactformulier bericht",
      message: `${name}: "${subject.substring(0, 80)}"`,
      priority: "medium",
      action_url: "/admin/messages",
      data: { message_id: msg.id, from: email, sender_name: name },
    });

    // Forward email if enabled
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (tenant.email_forward_enabled && tenant.email_forward_address && resendApiKey) {
      await forwardEmail(
        tenant.name,
        tenant.email_forward_address,
        name,
        email,
        subject,
        message,
        resendApiKey
      );
    }

    console.log("Contact form processed:", { tenant: tenant.id, message_id: msg.id });

    return new Response(JSON.stringify({ success: true, message_id: msg.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Contact form error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
