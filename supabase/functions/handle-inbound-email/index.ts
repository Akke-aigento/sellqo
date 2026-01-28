import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend Webhook Event Wrapper
interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: ResendInboundEmailData;
}

// Resend Inbound Email Data (inside webhook wrapper - minimal, no body)
interface ResendInboundEmailData {
  email_id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;  // Optional - webhook may not include
  html?: string;  // Optional - webhook may not include
  headers?: Record<string, string>;
  message_id?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    content_disposition?: string;
    content_id?: string;
  }>;
}

// Resend Retrieved Email Response (from API call - includes full body)
interface ResendRetrievedEmail {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  message_id?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
  }>;
  created_at: string;
}

// Extract email prefix from address like "prefix@sellqo.app"
function extractPrefix(email: string): string | null {
  const match = email.match(/^([^@]+)@sellqo\.app$/i);
  return match ? match[1].toLowerCase() : null;
}

// Parse Bol.com order ID from subject
function parseBolOrderId(subject: string): string | null {
  const pattern1 = /bestelling\s+(\d{10,})/i;
  const match1 = subject.match(pattern1);
  if (match1) return match1[1];

  const pattern2 = /\b(\d{10,})\b/;
  const match2 = subject.match(pattern2);
  if (match2) return match2[1];

  return null;
}

// Detect source channel from email/headers
function detectSourceChannel(
  fromEmail: string,
  subject: string
): { channel: string; marketplace?: string } {
  const fromLower = fromEmail.toLowerCase();
  const subjectLower = subject.toLowerCase();

  if (fromLower.includes('bol.com') || fromLower.includes('klantbericht.bol')) {
    return { channel: 'marketplace', marketplace: 'bol_com' };
  }

  if (fromLower.includes('amazon') || fromLower.includes('marketplace.amazon')) {
    return { channel: 'marketplace', marketplace: 'amazon' };
  }

  if (subjectLower.includes('bol.com') || subjectLower.includes('bestelling')) {
    return { channel: 'marketplace', marketplace: 'bol_com' };
  }

  return { channel: 'email' };
}

// Fetch full email content from Resend API
async function fetchEmailContent(emailId: string, apiKey: string): Promise<ResendRetrievedEmail | null> {
  try {
    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API error (${response.status}):`, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return data as ResendRetrievedEmail;
  } catch (error) {
    console.error('Failed to fetch email from Resend:', error);
    return null;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse Resend webhook event wrapper
    const webhook: ResendWebhookEvent = await req.json();
    
    // Validate event type - only process inbound emails
    if (webhook.type !== 'email.received') {
      console.log('Ignoring non-inbound event:', webhook.type);
      return new Response(JSON.stringify({ message: 'Event ignored', type: webhook.type }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extract the actual email data from the wrapper
    const payload = webhook.data;

    console.log("Inbound email received:", {
      email_id: payload.email_id,
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
    });

    // Fetch full email content from Resend API
    const retrievedEmail = await fetchEmailContent(payload.email_id, resendApiKey);
    
    console.log("Retrieved email content:", {
      email_id: payload.email_id,
      has_html: !!retrievedEmail?.html,
      has_text: !!retrievedEmail?.text,
      html_length: retrievedEmail?.html?.length ?? 0,
      text_length: retrievedEmail?.text?.length ?? 0,
    });

    // Compute body_html - MUST be non-null
    let bodyHtml: string;
    let bodyText: string | null = null;

    if (retrievedEmail?.html) {
      bodyHtml = retrievedEmail.html;
      bodyText = retrievedEmail.text ?? null;
    } else if (retrievedEmail?.text) {
      bodyHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${retrievedEmail.text}</pre>`;
      bodyText = retrievedEmail.text;
    } else if (payload.html) {
      // Fallback to webhook data if available
      bodyHtml = payload.html;
      bodyText = payload.text ?? null;
    } else if (payload.text) {
      bodyHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${payload.text}</pre>`;
      bodyText = payload.text;
    } else {
      // Final fallback - empty email
      bodyHtml = '<p style="color: #666; font-style: italic;">(Geen inhoud)</p>';
      bodyText = null;
    }

    // Find the tenant by parsing the TO address
    let tenantId: string | null = null;
    let tenantPrefix: string | null = null;

    for (const toEmail of payload.to) {
      const prefix = extractPrefix(toEmail);
      if (prefix) {
        tenantPrefix = prefix;
        
        const { data: tenant, error } = await supabase
          .from("tenants")
          .select("id, name, inbound_email_enabled")
          .eq("inbound_email_prefix", prefix)
          .maybeSingle();

        if (tenant && !error) {
          tenantId = tenant.id;
          
          if (!tenant.inbound_email_enabled) {
            console.log(`Inbound email disabled for tenant ${tenant.name}`);
          }
          break;
        }
      }
    }

    if (!tenantId) {
      console.error("No tenant found for inbound email", { to: payload.to, prefix: tenantPrefix });
      return new Response(
        JSON.stringify({ error: "Tenant not found", prefix: tenantPrefix }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Detect source channel
    const { channel, marketplace } = detectSourceChannel(payload.from, payload.subject);

    // Try to find Bol.com order ID from subject
    const bolOrderId = parseBolOrderId(payload.subject);
    let orderId: string | null = null;
    let customerId: string | null = null;

    if (bolOrderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, customer_id, order_number")
        .eq("tenant_id", tenantId)
        .eq("marketplace_order_id", bolOrderId)
        .maybeSingle();

      if (order) {
        orderId = order.id;
        customerId = order.customer_id;
        console.log(`Matched Bol.com order: ${order.order_number}`);
      }
    }

    // If no order match, try to find customer by email
    if (!customerId) {
      const emailMatch = payload.from.match(/<([^>]+)>/) || [null, payload.from];
      const cleanEmail = emailMatch[1] || payload.from;

      const { data: customer } = await supabase
        .from("customers")
        .select("id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .eq("email", cleanEmail.toLowerCase())
        .maybeSingle();

      if (customer) {
        customerId = customer.id;
      }
    }

    // Extract Message-ID from retrieved email or webhook data
    const incomingMessageId = retrievedEmail?.message_id || payload.message_id || payload.headers?.['message-id'] || payload.headers?.['Message-ID'] || null;
    const incomingReferences = payload.headers?.['references'] || payload.headers?.['References'] || null;

    // Store the inbound message
    const { data: message, error: insertError } = await supabase
      .from("customer_messages")
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        order_id: orderId,
        direction: "inbound",
        channel: channel,
        subject: payload.subject,
        body_html: bodyHtml,
        body_text: bodyText,
        from_email: payload.from,
        to_email: payload.to[0] || "",
        reply_to_email: payload.from,
        status: "delivered",
        delivered_at: new Date().toISOString(),
        context_type: orderId ? "order" : "general",
        resend_id: payload.email_id,
        context_data: {
          marketplace: marketplace || null,
          bol_order_id: bolOrderId || null,
          has_attachments: (payload.attachments?.length || 0) > 0,
          attachment_count: payload.attachments?.length || 0,
          message_id: incomingMessageId,
          references: incomingReferences,
          resend_email_id: payload.email_id,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store inbound message:", insertError);
      throw new Error(`Failed to store message: ${insertError.message}`);
    }

    // Store attachment metadata (Resend provides id, not content)
    if (payload.attachments && payload.attachments.length > 0) {
      console.log(`Processing ${payload.attachments.length} attachment metadata entries`);
      
      for (const attachment of payload.attachments) {
        try {
          await supabase.from('customer_message_attachments').insert({
            message_id: message.id,
            tenant_id: tenantId,
            filename: attachment.filename,
            content_type: attachment.content_type,
            size_bytes: 0,
            storage_path: null,
            metadata: {
              resend_attachment_id: attachment.id,
              content_disposition: attachment.content_disposition,
              content_id: attachment.content_id,
              requires_fetch: true,
            }
          });
          
          console.log(`Stored attachment reference: ${attachment.filename}`);
        } catch (attachError) {
          console.error(`Error storing attachment ${attachment.filename}:`, attachError);
        }
      }
    }

    // Get customer name for notification
    let customerName = "Onbekende afzender";
    if (customerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("first_name, last_name, company_name")
        .eq("id", customerId)
        .single();

      if (customer) {
        customerName = 
          [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
          customer.company_name ||
          "Klant";
      }
    } else {
      const nameMatch = payload.from.match(/^([^<]+)\s*</);
      if (nameMatch) {
        customerName = nameMatch[1].trim().replace(/"/g, "");
      }
    }

    // Create notification for merchant
    const notificationTitle = marketplace === "bol_com" 
      ? "Bol.com klantvraag ontvangen"
      : "E-mail ontvangen";

    const notificationMessage = `${customerName}: "${payload.subject.substring(0, 80)}${payload.subject.length > 80 ? "..." : ""}"`;

    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      category: "messages",
      type: marketplace === "bol_com" ? "bol_inbound" : "email_inbound",
      title: notificationTitle,
      message: notificationMessage,
      priority: "medium",
      action_url: "/admin/messages",
      is_read: false,
      metadata: {
        message_id: message.id,
        from: payload.from,
        order_id: orderId,
        marketplace: marketplace,
      },
    });

    console.log("Inbound email processed successfully:", {
      message_id: message.id,
      tenant_id: tenantId,
      channel,
      marketplace,
      matched_order: orderId ? true : false,
      body_html_length: bodyHtml.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        tenant_id: tenantId,
        matched_order: orderId,
        matched_customer: customerId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing inbound email:", error);
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
