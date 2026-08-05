import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocType = "invoice" | "credit_note" | "shipping_label" | "payment_request";
type Kind = "pdf" | "ubl";

const TABLE: Record<DocType, string> = {
  invoice: "invoices",
  credit_note: "credit_notes",
  shipping_label: "shipping_labels",
  // CYCLE-2: betalingsverzoeken leven op billing_cycles.
  payment_request: "billing_cycles",
};

const BUCKET: Record<DocType, string> = {
  invoice: "invoices",
  credit_note: "credit-notes",
  shipping_label: "shipping-labels",
  payment_request: "invoices",
};

const NUMBER_COL: Record<DocType, string> = {
  invoice: "invoice_number",
  credit_note: "credit_note_number",
  // shipping_labels heeft geen eigen documentnummer; tracking_number is de
  // meest herkenbare identifier voor de gebruiker.
  shipping_label: "tracking_number",
  payment_request: "payment_request_number",
};

// Verzendlabels gebruiken `label_path` (geen ubl-variant). We selecteren nooit
// hardgecodeerd `pdf_path`/`ubl_path` — die kolommen bestaan niet op
// `shipping_labels`.
const PATH_COL: Record<DocType, { pdf: string; ubl: string | null }> = {
  invoice: { pdf: "pdf_path", ubl: "ubl_path" },
  credit_note: { pdf: "pdf_path", ubl: "ubl_path" },
  shipping_label: { pdf: "label_path", ubl: null },
  payment_request: { pdf: "pdf_path", ubl: null },
};

const SIGNED_TTL = 600; // 10 minutes

function badRequest(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const doc_type = body?.doc_type as DocType | undefined;
    const kind = body?.kind as Kind | undefined;
    const doc_id = body?.doc_id as string | undefined;
    const doc_ids = body?.doc_ids as string[] | undefined;

    if (
      doc_type !== "invoice" &&
      doc_type !== "credit_note" &&
      doc_type !== "shipping_label" &&
      doc_type !== "payment_request"
    ) {
      return badRequest("doc_type must be 'invoice', 'credit_note', 'shipping_label' or 'payment_request'");
    }
    if (kind !== "pdf" && kind !== "ubl") {
      return badRequest("kind must be 'pdf' or 'ubl'");
    }
    if (!doc_id && !(Array.isArray(doc_ids) && doc_ids.length > 0)) {
      return badRequest("doc_id or doc_ids required");
    }
    if (Array.isArray(doc_ids) && doc_ids.length > 200) {
      return badRequest("Maximum 200 doc_ids per request");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const table = TABLE[doc_type];
    const bucket = BUCKET[doc_type];
    const numberCol = NUMBER_COL[doc_type];
    const pathCol = PATH_COL[doc_type][kind];
    if (!pathCol) {
      return badRequest(`kind '${kind}' is not supported for doc_type '${doc_type}'`);
    }

    const ids = doc_id ? [doc_id] : (doc_ids as string[]);

    const { data: rows, error: rowsErr } = await admin
      .from(table)
      .select(`id, tenant_id, ${numberCol}, ${pathCol}`)
      .in("id", ids);

    if (rowsErr) {
      return new Response(JSON.stringify({ error: rowsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All rows must belong to a single tenant.
    const tenantIds = Array.from(new Set(rows.map((r: any) => r.tenant_id)));
    if (tenantIds.length !== 1) {
      return badRequest("All documents must belong to the same tenant");
    }
    const tenantId = tenantIds[0] as string;

    // Auth against the resolved tenant. Throws 401/403 as needed.
    await authenticateRequest(req, tenantId);

    // Single-doc form: enforce 404 on missing path.
    if (doc_id) {
      const row = rows[0] as any;
      const path = row[pathCol] as string | null;
      if (!path) {
        return new Response(JSON.stringify({ error: "Document path missing" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: signed, error: signErr } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_TTL);
      if (signErr || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: signErr?.message || "Sign failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ url: signed.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch form: skip rows without a path.
    const files: Array<{ id: string; name: string; url: string }> = [];
    for (const row of rows as any[]) {
      const path = row[pathCol] as string | null;
      if (!path) continue;
      const { data: signed, error: signErr } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_TTL);
      if (signErr || !signed?.signedUrl) continue;
      const ext = kind === "ubl" ? "xml" : "pdf";
      const numberVal = row[numberCol] as string | null;
      const fallback = doc_type === "shipping_label" ? `label-${row.id}` : `${row.id}`;
      const name = `${numberVal ?? fallback}.${ext}`;
      files.push({ id: row.id, name, url: signed.signedUrl });
    }

    return new Response(JSON.stringify({ files }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[get-document-url] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});