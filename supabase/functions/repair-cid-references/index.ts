import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find messages with CID references in body_html or body_text
    const { data: messages, error: queryError } = await supabase
      .from('customer_messages')
      .select('id, tenant_id, body_html, body_text')
      .or('body_html.ilike.%cid:%,body_text.ilike.%cid:%')
      .limit(100);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    console.log(`Found ${messages?.length || 0} messages with CID references`);

    let repairedCount = 0;
    const results: Array<{ message_id: string; replacements: number }> = [];

    for (const message of messages || []) {
      // Get attachments with content_id for this message
      const { data: attachments } = await supabase
        .from('customer_message_attachments')
        .select('storage_path, metadata')
        .eq('message_id', message.id)
        .not('storage_path', 'is', null);

      if (!attachments || attachments.length === 0) {
        // No attachments to replace with, just clean up CID text
        let updatedHtml = message.body_html || '';
        let updatedText = message.body_text || '';

        // Remove orphan CID references
        const cidPattern = /\[?cid:[^\]\s<>]+\]?/gi;
        const htmlHadCid = cidPattern.test(updatedHtml);
        const textHadCid = cidPattern.test(updatedText);

        if (htmlHadCid || textHadCid) {
          updatedHtml = updatedHtml.replace(cidPattern, '');
          updatedText = updatedText.replace(cidPattern, '');

          await supabase
            .from('customer_messages')
            .update({ 
              body_html: updatedHtml,
              body_text: updatedText || null
            })
            .eq('id', message.id);

          results.push({ message_id: message.id, replacements: -1 }); // -1 = cleaned orphans
          repairedCount++;
        }
        continue;
      }

      let updatedHtml = message.body_html || '';
      let replacementCount = 0;

      for (const attachment of attachments) {
        const contentId = attachment.metadata?.content_id;
        if (!contentId || !attachment.storage_path) continue;

        // Clean content_id (remove angle brackets if present)
        const cleanContentId = contentId.replace(/^<|>$/g, '');

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(attachment.storage_path);

        if (!urlData?.publicUrl) continue;

        // Replace cid: references in HTML
        const escapedId = cleanContentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
          new RegExp(`cid:${escapedId}`, 'gi'),
          new RegExp(`cid:<${escapedId}>`, 'gi'),
          new RegExp(`\\[cid:${escapedId}\\]`, 'gi'),
        ];

        for (const pattern of patterns) {
          if (pattern.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(pattern, urlData.publicUrl);
            replacementCount++;
          }
        }
      }

      if (replacementCount > 0) {
        await supabase
          .from('customer_messages')
          .update({ body_html: updatedHtml })
          .eq('id', message.id);

        results.push({ message_id: message.id, replacements: replacementCount });
        repairedCount++;
        console.log(`Repaired message ${message.id}: ${replacementCount} CID replacements`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messages_found: messages?.length || 0,
        messages_repaired: repairedCount,
        details: results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error repairing CID references:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
