// EVENT-SCAN-1 — "SellQo Deur": teller en zoeken-op-naam voor de scanner aan de deur.
// Werkt met dezelfde twee modi als ticket-checkin:
//   - token-modus (crew-scanlink, geen account): x-scanner-token header of body.scanner_token;
//     het event komt UITSLUITEND uit de event_scanner_access-rij;
//   - JWT-modus (admin-scanner): event_detail_id uit de body, rol tenant_admin of staff.
// Acties:
//   - stats:  { sold, inside } voor het event (geldige + binnen; binnen = checked_in);
//   - search: tickets van dit event op naam, e-mail of bestelnummer (max 15). Geeft GEEN
//             e-mailadres terug, wel het qr_token zodat de scanner het ticket kan inchecken.
// Check-in zelf blijft in ticket-checkin (één poort, één scanlog).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { loadScanWindow, resolveDoor } from "../_shared/doorWindow.ts";

const VERSION = "EVENT-SCAN-2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scanner-token",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const SCANNER_TOKEN_RE = /^[a-f0-9]{64}$/;

/** EVENT-SCAN-2 — de events waar deze deur nu voor telt: venster open, anders
 *  het eerstvolgende (zodat de teller vóór de deuren opengaan al iets toont). */
async function doorEventIds(admin: { from(table: string): unknown }, tenantId: string): Promise<string[]> {
  const settings = await loadScanWindow(admin, tenantId);
  const door = await resolveDoor(admin, tenantId, settings);
  if (door.live.length > 0) return door.live.map((e) => e.id);
  return door.next ? [door.next.id] : [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action !== "stats" && action !== "search") return json({ success: false, error: "invalid action" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const scannerToken = String(req.headers.get("x-scanner-token") ?? body.scanner_token ?? "").trim();

    let tenantId: string;
    // EVENT-SCAN-2 — meerdere event-ids: een vaste deurlink of de automatische
    // stand telt en zoekt over alle events waarvan het venster nu open staat.
    let eventIds: string[];
    if (scannerToken) {
      if (!SCANNER_TOKEN_RE.test(scannerToken)) return json({ success: false, error: "invalid scanner token" }, 401);
      const { data: row } = await admin.from("event_scanner_access")
        .select("tenant_id, event_detail_id, expires_at")
        .eq("access_token", scannerToken).eq("is_active", true).maybeSingle();
      if (!row || (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now())) {
        return json({ success: false, error: "invalid scanner token" }, 401);
      }
      tenantId = row.tenant_id as string;
      eventIds = row.event_detail_id ? [row.event_detail_id as string] : await doorEventIds(admin, tenantId);
    } else if (body.auto === true && body.tenant_id) {
      tenantId = String(body.tenant_id).trim();
      const auth = await authenticateRequest(req, tenantId);
      requireRole(auth, tenantId, ["tenant_admin", "staff"]);
      eventIds = await doorEventIds(admin, tenantId);
    } else {
      const eventId = String(body.event_detail_id ?? "").trim();
      if (!eventId) return json({ success: false, error: "event_detail_id required" }, 400);
      const { data: ev } = await admin.from("event_details").select("tenant_id").eq("id", eventId).maybeSingle();
      if (!ev) return json({ success: false, error: "event not found" }, 404);
      tenantId = ev.tenant_id as string;
      const auth = await authenticateRequest(req, tenantId);
      requireRole(auth, tenantId, ["tenant_admin", "staff"]);
      eventIds = [eventId];
    }
    if (eventIds.length === 0) return json({ success: true, sold: 0, inside: 0, results: [] });

    if (action === "stats") {
      const base = () => admin.from("ticket_instances").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).in("event_detail_id", eventIds);
      const [{ count: sold }, { count: inside }] = await Promise.all([
        base().in("status", ["valid", "checked_in"]),
        base().eq("status", "checked_in"),
      ]);
      return json({ success: true, sold: sold ?? 0, inside: inside ?? 0 });
    }

    // search
    const q = String(body.q ?? "").trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ");
    if (q.length < 2) return json({ success: true, results: [] });
    const like = `%${q}%`;

    // Bestelnummers die matchen (binnen deze tenant), dan tickets op naam/e-mail of die orders.
    const { data: orders } = await admin.from("orders").select("id")
      .eq("tenant_id", tenantId).ilike("order_number", like).limit(20);
    const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
    const filters = [`attendee_name.ilike.${like}`, `attendee_email.ilike.${like}`];
    if (orderIds.length > 0) filters.push(`order_id.in.(${orderIds.join(",")})`);

    const { data: tickets, error } = await admin.from("ticket_instances")
      .select("qr_token, attendee_name, seq, status, checked_in_at, orders(order_number), products(name)")
      .eq("tenant_id", tenantId).in("event_detail_id", eventIds)
      .or(filters.join(","))
      .order("attendee_name", { ascending: true })
      .limit(15);
    if (error) {
      console.error("[SCANNER-DOOR] search failed", error.message);
      return json({ success: false, error: "search failed" }, 500);
    }
    return json({
      success: true,
      results: ((tickets ?? []) as Record<string, unknown>[]).map((t) => ({
        qr_token: t.qr_token,
        attendee: t.attendee_name ?? null,
        seq: t.seq ?? null,
        status: t.status,
        checked_in_at: t.checked_in_at ?? null,
        order_number: (t as { orders?: { order_number?: string } }).orders?.order_number ?? null,
        ticket_type: (t as { products?: { name?: string } }).products?.name ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    console.error("[SCANNER-DOOR]", err instanceof Error ? err.message : err);
    return json({ success: false, error: "unexpected error" }, 500);
  }
});
