import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  content_disposition: string;
  content_id?: string;
  download_url: string;
  expires_at: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find attachments that need repair (0 bytes or no storage path)
    const { data: brokenAttachments, error: fetchError } = await supabase
      .from('customer_message_attachments')
      .select(`
        id,
        message_id,
        tenant_id,
        filename,
        metadata,
        customer_messages!inner(resend_id)
      `)
      .or('size_bytes.eq.0,storage_path.is.null')
      .limit(20);

    if (fetchError) {
      console.error("Failed to fetch broken attachments:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${brokenAttachments?.length || 0} attachments to repair`);

    let repaired = 0;
    let failed = 0;
    const results: Array<{ filename: string; status: string; error?: string }> = [];

    for (const att of brokenAttachments || []) {
      const emailId = (att.customer_messages as any)?.resend_id;
      if (!emailId) {
        console.log(`Skipping ${att.filename}: no resend_id on message`);
        results.push({ filename: att.filename, status: 'skipped', error: 'no resend_id' });
        continue;
      }

      try {
        // Fetch attachments list from Resend
        const listResponse = await fetch(
          `https://api.resend.com/emails/receiving/${emailId}/attachments`,
          {
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          }
        );

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error(`Resend API error for ${att.filename}:`, errorText);
          results.push({ filename: att.filename, status: 'failed', error: `API error: ${listResponse.status}` });
          failed++;
          continue;
        }

        const listData = await listResponse.json();
        const attachments: ResendAttachment[] = listData.data || [];

        // Find matching attachment by filename or resend_attachment_id
        const resendAttId = att.metadata?.resend_attachment_id;
        const matchingAtt = attachments.find(
          (a) => a.id === resendAttId || a.filename === att.filename
        );

        if (!matchingAtt) {
          console.log(`No matching Resend attachment found for ${att.filename}`);
          results.push({ filename: att.filename, status: 'failed', error: 'not found in Resend' });
          failed++;
          continue;
        }

        // Download binary
        const downloadResponse = await fetch(matchingAtt.download_url);
        if (!downloadResponse.ok) {
          results.push({ filename: att.filename, status: 'failed', error: `download failed: ${downloadResponse.status}` });
          failed++;
          continue;
        }

        const binaryData = await downloadResponse.arrayBuffer();
        const fileBuffer = new Uint8Array(binaryData);
        console.log(`Downloaded ${att.filename}: ${fileBuffer.length} bytes`);

        // Upload to storage
        const storagePath = `${att.tenant_id}/${att.message_id}/${matchingAtt.id}_${att.filename}`;
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(storagePath, fileBuffer, {
            contentType: matchingAtt.content_type,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Storage upload failed for ${att.filename}:`, uploadError);
          results.push({ filename: att.filename, status: 'failed', error: `upload: ${uploadError.message}` });
          failed++;
          continue;
        }

        // Update database record
        const { error: updateError } = await supabase
          .from('customer_message_attachments')
          .update({
            size_bytes: matchingAtt.size || fileBuffer.length,
            storage_path: storagePath,
            metadata: {
              ...att.metadata,
              requires_fetch: false,
              repaired_at: new Date().toISOString(),
            },
          })
          .eq('id', att.id);

        if (updateError) {
          console.error(`DB update failed for ${att.filename}:`, updateError);
          results.push({ filename: att.filename, status: 'failed', error: `db: ${updateError.message}` });
          failed++;
          continue;
        }

        console.log(`Successfully repaired: ${att.filename}`);
        results.push({ filename: att.filename, status: 'repaired' });
        repaired++;
      } catch (err) {
        console.error(`Error processing ${att.filename}:`, err);
        results.push({ filename: att.filename, status: 'failed', error: String(err) });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        total: brokenAttachments?.length || 0,
        repaired,
        failed,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in repair-attachments:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
