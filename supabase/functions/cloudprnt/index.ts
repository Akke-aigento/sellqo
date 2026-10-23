// PRINT-1 — Star CloudPRNT-server voor SellQo Kassa. De printer pollt deze functie
// (verify_jwt = false: een printer heeft geen Supabase-JWT; hij meldt zich aan met zijn eigen
// printer-token, zie _shared/cloudprnt.ts). Alle protocollogica zit in _shared/cloudprnt.ts.
//
// Deze functie leest en schrijft met service_role: printers.token_hash opzoeken (nooit
// teruggeven), printers.last_seen_at/last_status bijwerken en print_jobs van status laten
// veranderen. De guard-trigger op print_jobs laat nooit toe dat een afgedrukte job opnieuw
// in de wachtrij komt (herafdruk = copy-event, FAQ Q503).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { handleCloudPrnt, type CloudPrntStore, type CpJob, type CpPrinter } from "../_shared/cloudprnt.ts";

const JOB_COLUMNS = "id, printer_id, status, payload_text, payload_escpos";

function makeStore(): CloudPrntStore {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  return {
    async printerByTokenHash(hash) {
      const { data, error } = await supabase.from("printers").select("id, tenant_id, protocol, is_active").eq("token_hash", hash).maybeSingle();
      if (error) throw new Error(`printers: ${error.message}`);
      return (data as CpPrinter | null) ?? null;
    },
    async touchPrinter(printerId, info) {
      const { error } = await supabase.from("printers")
        .update({ last_seen_at: new Date().toISOString(), last_status: info.status, printer_mac: info.mac })
        .eq("id", printerId);
      if (error) console.error("cloudprnt touch", error.message);
    },
    async nextJob(printerId) {
      const { data, error } = await supabase.from("print_jobs").select(JOB_COLUMNS)
        .eq("printer_id", printerId).in("status", ["queued", "printing"])
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (error) throw new Error(`print_jobs: ${error.message}`);
      return (data as CpJob | null) ?? null;
    },
    async jobById(printerId, jobId) {
      const { data, error } = await supabase.from("print_jobs").select(JOB_COLUMNS)
        .eq("printer_id", printerId).eq("id", jobId).maybeSingle();
      if (error) throw new Error(`print_jobs: ${error.message}`);
      return (data as CpJob | null) ?? null;
    },
    async markPrinting(job) {
      const { data: cur } = await supabase.from("print_jobs").select("attempts").eq("id", job.id).maybeSingle();
      const attempts = ((cur as { attempts?: number } | null)?.attempts ?? 0) + 1;
      const { error } = await supabase.from("print_jobs")
        .update({ status: "printing", claimed_at: new Date().toISOString(), attempts })
        .eq("id", job.id).eq("status", "queued");
      if (error) throw new Error(`print_jobs printing: ${error.message}`);
      job.status = "printing";
    },
    async markDone(job, ok, err) {
      const patch = ok
        ? { status: "printed", printed_at: new Date().toISOString(), error: null }
        : { status: "failed", error: err };
      const { error } = await supabase.from("print_jobs").update(patch).eq("id", job.id).eq("status", "printing");
      if (error) throw new Error(`print_jobs done: ${error.message}`);
    },
  };
}

serve(async (req) => {
  try {
    return await handleCloudPrnt(req, makeStore());
  } catch (e) {
    console.error("cloudprnt", e instanceof Error ? e.message : String(e));
    return new Response(null, { status: 500 });
  }
});
