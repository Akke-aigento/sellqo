import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend Inbound Email Payload
interface ResendInboundPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type: string;
  }>;
}

// Extract email prefix from address like "prefix@sellqo.app"
function extractPrefix(email: string): string | null {
  const match = email.match(/^([^@]+)@sellqo\.app$/i);
  return match ? match[1].toLowerCase() : null;
}

// Parse Bol.com order ID from subject
// Examples: "Vraag over bestelling 1234567890", "Klantvraag - 9876543210"
function parseBolOrderId(subject: string): string | null {
  // Pattern 1: "bestelling" followed by numbers
  const pattern1 = /bestelling\s+(\d{10,})/i;
  const match1 = subject.match(pattern1);
  if (match1) return match1[1];

  // Pattern 2: Just a long number (Bol.com order IDs are typically 10+ digits)
  const pattern2 = /\b(\d{10,})\b/;
  const match2 = subject.match(pattern2);
  if (match2) return match2[1];

  return null;
}

// Detect source channel from email/headers
function detectSourceChannel(
  fromEmail: string,
  subject: string,
  headers: Record<string, string>
): { channel: string; marketplace?: string } {
  const fromLower = fromEmail.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // Bol.com detection
  if (fromLower.includes('bol.com') || fromLower.includes('klantbericht.bol')) {
    return { channel: 'marketplace', marketplace: 'bol_com' };
  }

  // Amazon detection
  if (fromLower.includes('amazon') || fromLower.includes('marketplace.amazon')) {
    return { channel: 'marketplace', marketplace: 'amazon' };
  }

  // Check subject for marketplace indicators
  if (subjectLower.includes('bol.com') || subjectLower.includes('bestelling')) {
    return { channel: 'marketplace', marketplace: 'bol_com' };
  }

  // Default to general email
  return { channel: 'email' };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST for webhook
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

    const payload: ResendInboundPayload = await req.json();
    console.log("Inbound email received:", {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
    });

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
          
          // Check if inbound is enabled
          if (!tenant.inbound_email_enabled) {
            console.log(`Inbound email disabled for tenant ${tenant.name}`);
            // Still accept but log
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

    // Detect source channel (Bol.com, Amazon, general email)
    const { channel, marketplace } = detectSourceChannel(
      payload.from,
      payload.subject,
      payload.headers
    );

    // Try to find Bol.com order ID from subject
    const bolOrderId = parseBolOrderId(payload.subject);
    let orderId: string | null = null;
    let customerId: string | null = null;

    if (bolOrderId) {
      // Try to match order by marketplace_order_id
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
      // Extract clean email from "Name <email@domain.com>" format
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

    // Extract Message-ID from headers for threading
    const incomingMessageId = payload.headers['message-id'] || payload.headers['Message-ID'] || null;
    const incomingReferences = payload.headers['references'] || payload.headers['References'] || null;

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
        body_html: payload.html || payload.text,
        body_text: payload.text,
        from_email: payload.from,
        to_email: payload.to[0] || "",
        reply_to_email: payload.from, // Important: save sender for reply flow
        status: "delivered",
        delivered_at: new Date().toISOString(),
        context_type: orderId ? "order" : "general",
        context_data: {
          marketplace: marketplace || null,
          bol_order_id: bolOrderId || null,
          has_attachments: (payload.attachments?.length || 0) > 0,
          attachment_count: payload.attachments?.length || 0,
          message_id: incomingMessageId,
          references: incomingReferences,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store inbound message:", insertError);
      throw new Error(`Failed to store message: ${insertError.message}`);
    }

    // Upload attachments if present
    if (payload.attachments && payload.attachments.length > 0) {
      console.log(`Processing ${payload.attachments.length} attachments`);
      
      for (const attachment of payload.attachments) {
        try {
          const storagePath = `${tenantId}/messages/${message.id}/${attachment.filename}`;
          
          // Decode base64 content
          const binaryString = atob(attachment.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(storagePath, bytes, {
              contentType: attachment.content_type,
              upsert: true,
            });
          
          if (uploadError) {
            console.error(`Failed to upload attachment ${attachment.filename}:`, uploadError);
            continue;
          }
          
          // Save reference in database
          await supabase.from('customer_message_attachments').insert({
            message_id: message.id,
            tenant_id: tenantId,
            filename: attachment.filename,
            content_type: attachment.content_type,
            size_bytes: bytes.length,
            storage_path: storagePath,
          });
          
          console.log(`Uploaded attachment: ${attachment.filename}`);
        } catch (attachError) {
          console.error(`Error processing attachment ${attachment.filename}:`, attachError);
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
      // Extract name from email if available
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
