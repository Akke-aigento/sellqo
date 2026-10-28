// PRINT-2 — maakt printopdrachten (print_jobs) voor de bonprinters van een zaak.
//
// Twee soorten aanroepen:
//   - Databank (horeca_print_call via pg_net, met X-Internal-Secret):
//       { kind: "ticket",  id }  nieuwe keuken-/barbon (kitchen_tickets) → printer van zijn post
//       { kind: "order",   id }  webshoporder die in de keuken hoort → printer van de standaardpost
//       { kind: "receipt", id }  betaling aan de kassa (check_payments) → betaalbewijs op de kassaprinter
//   - Beheer (Kassa › Bon & printers, met de sessie van een beheerder):
//       { kind: "test", printer_id }  testafdruk
// De printer haalt de opdracht zelf op via de edge function cloudprnt (Star CloudPRNT).
// Dubbel afdrukken kan niet: dedupe_key is uniek per zaak (ticket:/order:/receipt:<id>).
// Bij een geregistreerde kassa (FDM) nooit een betaalbewijs: daar maakt de kassa het kasticket.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse, requireRole } from "../_shared/auth.ts";
import {
  printWidth, renderProductionTicket, renderReceiptText, renderTestPage,
  type ProductionItem, type ProductionTicket,
} from "../_shared/horecaPrint.ts";
import { receiptModelFromData, type ReceiptData } from "../_shared/horecaReceipt.ts";

const VERSION = "PRINT-2b";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Printer { id: string; tenant_id: string; name: string; protocol: string; width_chars: number; lang: string; is_active: boolean }
// deno-lint-ignore no-explicit-any
type Db = any;

const PRINTER_COLS = "id, tenant_id, name, protocol, width_chars, lang, is_active";

async function activePrinter(db: Db, id: string | null | undefined): Promise<Printer | null> {
  if (!id) return null;
  const { data } = await db.from("printers").select(PRINTER_COLS).eq("id", id).maybeSingle();
  const p = data as Printer | null;
  // Enkel Star CloudPRNT kan zelf zijn opdrachten ophalen (PRINT-1); andere protocollen: later.
  return p && p.is_active && p.protocol === "star_cloudprnt" ? p : null;
}

async function storeName(db: Db, tenantId: string): Promise<string> {
  const { data } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return String((data as { name?: string } | null)?.name ?? "");
}

async function enqueue(db: Db, printer: Printer, kind: string, text: string, dedupe: string) {
  const { error } = await db.from("print_jobs").insert({
    tenant_id: printer.tenant_id, printer_id: printer.id, kind, payload_text: text, dedupe_key: dedupe,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { queued: false, duplicate: true };
    throw new Error(`print_jobs: ${error.message}`);
  }
  return { queued: true };
}

function addonNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => (a && typeof a === "object" && "name" in a ? String((a as { name: unknown }).name ?? "") : typeof a === "string" ? a : ""))
    .filter(Boolean);
}

/** Zelfde regel als het keukenscherm: de varianttitel van een webshopregel bevat ook de extra's. */
function variantOnly(title: string | null, addons: string[]): string | null {
  if (!title) return null;
  if (!addons.length) return title;
  const suffix = addons.join(", ");
  if (title === suffix) return null;
  return title.endsWith(` · ${suffix}`) ? title.slice(0, -(suffix.length + 3)) || null : title;
}

const asService = (s: unknown) => (s === "pickup" || s === "local_delivery" || s === "eat_in" ? s : null);

/** PRINT-2b: printer voor bonnen zonder post (een zaak zonder posten, of zonder standaardpost). */
async function fallbackPrinter(db: Db, tenantId: string): Promise<Printer | null> {
  const { data } = await db.from("horeca_pay_settings").select("ticket_printer_id").eq("tenant_id", tenantId).maybeSingle();
  return activePrinter(db, (data as { ticket_printer_id?: string | null } | null)?.ticket_printer_id);
}

async function printTicket(db: Db, id: string) {
  const { data: t } = await db.from("kitchen_tickets").select("*").eq("id", id).maybeSingle();
  if (!t) return { skipped: "not_found" };
  const stationId = t.station_id ?? (await db.from("prep_stations").select("id").eq("tenant_id", t.tenant_id)
    .eq("is_default", true).eq("is_active", true).limit(1).maybeSingle()).data?.id ?? null;
  const { data: st } = stationId
    ? await db.from("prep_stations").select("id, name, kind, printer_id").eq("id", stationId).maybeSingle()
    : { data: null };
  // Een bon van een post gaat enkel naar de printer van die post; een bon zonder post naar de printer
  // voor "bonnen zonder post" (Kassa › Bon & printers).
  const printer = st ? await activePrinter(db, st.printer_id) : await fallbackPrinter(db, t.tenant_id);
  if (!printer) return { skipped: "no_printer" };
  const source = t.source === "phone" || t.source === "table" || t.source === "pos" ? t.source : "pos";
  const items: ProductionItem[] = (Array.isArray(t.items) ? t.items : []).map((i: Record<string, unknown>) => ({
    quantity: Number(i.quantity) || 1,
    name: String(i.name ?? ""),
    detail: i.variant ? String(i.variant) : i.note ? String(i.note) : null,
    addons: addonNames(i.addons),
  }));
  const ticket: ProductionTicket = {
    storeName: await storeName(db, t.tenant_id), station: st?.name ?? null, source, service: asService(t.service_type),
    table: source === "table" ? t.table_label ?? null : null,
    customer: source === "table" && t.table_label && t.customer_label === t.table_label ? null : t.customer_label ?? null,
    phone: t.customer_phone ?? null, requestedTime: t.requested_time ?? null, createdAt: t.created_at, note: t.note ?? null, items,
  };
  const text = renderProductionTicket(ticket, st?.kind ?? null, printer.lang, printer.width_chars);
  return enqueue(db, printer, st?.kind === "bar" ? "bar" : "keuken", text, `ticket:${id}`);
}

async function printOrder(db: Db, id: string) {
  const { data: o } = await db.from("orders")
    .select("id, tenant_id, order_number, created_at, service_type, requested_time, customer_name, customer_phone, notes, table_label, order_items(product_name, variant_title, quantity, addons)")
    .eq("id", id).maybeSingle();
  if (!o) return { skipped: "not_found" };
  const { data: st } = await db.from("prep_stations").select("id, name, kind, printer_id").eq("tenant_id", o.tenant_id)
    .eq("is_default", true).eq("is_active", true).limit(1).maybeSingle();
  const printer = st ? await activePrinter(db, st.printer_id) : await fallbackPrinter(db, o.tenant_id);
  if (!printer) return { skipped: "no_printer" };
  const items: ProductionItem[] = ((o.order_items ?? []) as Record<string, unknown>[]).map((i) => {
    const addons = addonNames(i.addons);
    return { quantity: Number(i.quantity) || 1, name: String(i.product_name ?? ""), detail: variantOnly((i.variant_title as string | null) ?? null, addons), addons };
  });
  const ticket: ProductionTicket = {
    storeName: await storeName(db, o.tenant_id), station: st?.name ?? null, source: "webshop", service: asService(o.service_type),
    table: o.table_label ?? null, customer: o.customer_name || o.order_number || null, phone: o.customer_phone ?? null,
    requestedTime: o.requested_time ?? null, createdAt: o.created_at, note: o.notes ?? null, items,
  };
  const text = renderProductionTicket(ticket, st?.kind ?? null, printer.lang, printer.width_chars);
  return enqueue(db, printer, st?.kind === "bar" ? "bar" : "keuken", text, `order:${id}`);
}

async function printReceipt(db: Db, id: string) {
  const { data } = await db.rpc("horeca_receipt_data", { p_source: "kassa", p_id: id });
  const d = data as ReceiptData | null;
  if (!d) return { skipped: "not_found" };
  if (d.fiscal) return { skipped: "fiscal" };
  const { data: s } = await db.from("horeca_pay_settings").select("receipt_print, receipt_printer_id").eq("tenant_id", d.tenant_id).maybeSingle();
  if (!s?.receipt_print) return { skipped: "off" };
  const printer = await activePrinter(db, s.receipt_printer_id);
  if (!printer) return { skipped: "no_printer" };
  const text = renderReceiptText(receiptModelFromData(d), printer.lang, printer.width_chars);
  return enqueue(db, printer, "betaalbewijs", text, `receipt:${id}`);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => null) as { kind?: string; id?: string; printer_id?: string } | null;
    const kind = body?.kind ?? "";

    if (kind === "test") {
      // Testafdruk vanuit het beheer: enkel een beheerder van de zaak van die printer.
      const auth = await authenticateRequest(req);
      const printerId = body?.printer_id ?? "";
      if (!UUID.test(printerId)) return json({ error: "printer_id required" }, 400);
      const { data: p } = await db.from("printers").select(PRINTER_COLS).eq("id", printerId).maybeSingle();
      const printer = p as Printer | null;
      if (!printer) return json({ error: "printer not found" }, 404);
      requireRole(auth, printer.tenant_id, ["tenant_admin"]);
      if (!printer.is_active || printer.protocol !== "star_cloudprnt") return json({ error: "printer inactive" }, 409);
      const text = renderTestPage(await storeName(db, printer.tenant_id), printer.name, printer.lang, printWidth(printer.width_chars));
      return json(await enqueue(db, printer, "test", text, `test:${printer.id}:${Date.now()}`));
    }

    const internalSecret = req.headers.get("X-Internal-Secret")?.trim();
    const { data: secretRow } = await db.from("internal_config").select("value").eq("key", "internal_webhook_secret").maybeSingle();
    const expected = (secretRow?.value as string | undefined)?.trim();
    if (!internalSecret || !expected || internalSecret !== expected) return json({ error: "Unauthorized internal call" }, 401);

    const id = body?.id ?? "";
    if (!UUID.test(id)) return json({ error: "id required" }, 400);
    if (kind === "ticket") return json(await printTicket(db, id));
    if (kind === "order") return json(await printOrder(db, id));
    if (kind === "receipt") return json(await printReceipt(db, id));
    return json({ error: "unknown kind" }, 400);
  } catch (error: unknown) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in horeca-print:", msg);
    return json({ error: msg }, 500);
  }
});
