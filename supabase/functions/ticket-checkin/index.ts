// TICKET-1 fase 5 — check-in endpoint voor QR-tickets aan de deur.
//
// MIDDERNACHT-PRINCIPE (niet-onderhandelbaar): een check-in bindt zich ALTIJD
// aan een expliciet gekozen `event_detail_id`. Er wordt NERGENS afgeleid uit
// "event_date = vandaag" — events lopen over middernacht (crawl 21:00 → 03:00).
//
// Rolmapping:
//   host  (checkin + undo) = tenant_admin voor die tenant OF platform_admin
//   crew  (checkin only)   = staff
// platform_admin bypasst op edge-niveau.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) =>
  console.log(`[TICKET-CHECKIN] ${step}`, details ? JSON.stringify(details) : "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticateRequest(req);

    const body = await req.json().catch(() => ({}));
    const qrToken = String(body?.qr_token ?? "").trim();
    const eventDetailId = String(body?.event_detail_id ?? "").trim();
    const action = String(body?.action ?? "checkin");

    if (!TOKEN_RE.test(qrToken)) return json({ success: false, error: "invalid qr_token" }, 400);
    if (!eventDetailId) return json({ success: false, error: "event_detail_id required" }, 400);
    if (action !== "checkin" && action !== "undo") {
      return json({ success: false, error: "invalid action" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Gekozen event ophalen — dit bepaalt de tenant-scope.
    const { data: chosenEvent, error: evErr } = await admin
      .from("event_details")
      .select("id, tenant_id, event_date, start_time, end_time, location_name, status")
      .eq("id", eventDetailId)
      .maybeSingle();

    if (evErr) {
      console.error("[TICKET-CHECKIN] event lookup failed", evErr.message ?? JSON.stringify(evErr));
      return json({ success: false, error: "event lookup failed" }, 500);
    }
    if (!chosenEvent) return json({ success: false, error: "event not found" }, 404);

    const tenantId = chosenEvent.tenant_id as string;

    // 2. Tenant-toegang (platform_admin bypasst).
    if (!auth.is_platform_admin && !auth.tenant_ids.includes(tenantId)) {
      return json({ success: false, error: "No access to this tenant" }, 403);
    }

    const rolesForTenant = auth.roles_by_tenant?.[tenantId] ?? [];
    const isHost = auth.is_platform_admin || rolesForTenant.includes("tenant_admin");
    const isCrew = isHost || rolesForTenant.includes("staff");

    if (!isCrew) return json({ success: false, error: "Insufficient role for check-in" }, 403);

    // 3. Ticket ophalen — ALTIJD binnen de tenant van het gekozen event.
    const { data: ticket, error: tErr } = await admin
      .from("ticket_instances")
      .select("id, qr_token, status, checked_in_at, checked_in_by, event_detail_id, attendee_name, seq, tenant_id")
      .eq("qr_token", qrToken)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (tErr) {
      console.error("[TICKET-CHECKIN] ticket lookup failed", tErr.message ?? JSON.stringify(tErr));
      return json({ success: false, error: "ticket lookup failed" }, 500);
    }
    if (!ticket) {
      log("unknown_token", { tenant_id: tenantId });
      return json({ success: true, result: "invalid", reason: "unknown_token" });
    }

    // 4. Bindt aan het GEKOZEN event, nooit aan een datum.
    if (ticket.event_detail_id !== eventDetailId) {
      const { data: expected } = await admin
        .from("event_details")
        .select("event_date, start_time, location_name")
        .eq("id", ticket.event_detail_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return json({
        success: true,
        result: "wrong_event",
        attendee: ticket.attendee_name,
        expected_event: {
          date: expected?.event_date ?? null,
          start_time: expected?.start_time ?? null,
          name: expected?.location_name ?? null,
        },
      });
    }

    if (action === "undo") {
      if (!isHost) return json({ success: false, error: "Only a host can undo a check-in" }, 403);
      if (ticket.status !== "checked_in") {
        return json({ success: true, result: "not_checked_in", attendee: ticket.attendee_name });
      }

      const { data: undone, error: uErr } = await admin
        .from("ticket_instances")
        .update({ status: "valid", checked_in_at: null, checked_in_by: null })
        .eq("id", ticket.id)
        .eq("tenant_id", tenantId)
        .eq("status", "checked_in")
        .select("id")
        .maybeSingle();

      if (uErr) {
        console.error("[TICKET-CHECKIN] undo failed", uErr.message ?? JSON.stringify(uErr));
        return json({ success: false, error: "undo failed" }, 500);
      }
      if (!undone) return json({ success: true, result: "not_checked_in", attendee: ticket.attendee_name });

      // Traceerbaar via de bestaande audit-tabel (geen schema-wijziging nodig).
      const { error: logErr } = await admin.from("admin_actions_log").insert({
        admin_user_id: auth.user_id,
        target_tenant_id: tenantId,
        action_type: "ticket_checkin_undo",
        action_details: {
          ticket_id: ticket.id,
          event_detail_id: eventDetailId,
          seq: ticket.seq,
          attendee_name: ticket.attendee_name,
          previous_checked_in_at: ticket.checked_in_at,
        },
      });
      if (logErr) console.error("[TICKET-CHECKIN] audit log failed", logErr.message ?? JSON.stringify(logErr));

      log("undo ok", { ticket_id: ticket.id, by: auth.user_id });
      return json({ success: true, result: "undone", attendee: ticket.attendee_name, seq: ticket.seq });
    }

    // --- checkin ---
    if (ticket.status === "cancelled" || ticket.status === "refunded") {
      return json({ success: true, result: "invalid", reason: `ticket_${ticket.status}` });
    }
    if (ticket.status === "checked_in") {
      return json({
        success: true,
        result: "already",
        checked_in_at: ticket.checked_in_at,
        attendee: ticket.attendee_name,
        seq: ticket.seq,
      });
    }
    if (ticket.status !== "valid") {
      return json({ success: true, result: "invalid", reason: `ticket_${ticket.status}` });
    }

    // Conditionele update: bij twee gelijktijdige scans wint er precies één.
    const { data: updated, error: cErr } = await admin
      .from("ticket_instances")
      .update({
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        checked_in_by: auth.user_id === "service_role" ? null : auth.user_id,
      })
      .eq("id", ticket.id)
      .eq("tenant_id", tenantId)
      .eq("status", "valid")
      .select("id, attendee_name, seq, checked_in_at")
      .maybeSingle();

    if (cErr) {
      console.error("[TICKET-CHECKIN] checkin failed", cErr.message ?? JSON.stringify(cErr));
      return json({ success: false, error: "check-in failed" }, 500);
    }

    if (!updated) {
      // Race verloren → iemand anders checkte net in.
      const { data: fresh } = await admin
        .from("ticket_instances")
        .select("checked_in_at, attendee_name, seq")
        .eq("id", ticket.id)
        .maybeSingle();
      return json({
        success: true,
        result: "already",
        checked_in_at: fresh?.checked_in_at ?? null,
        attendee: fresh?.attendee_name ?? ticket.attendee_name,
        seq: fresh?.seq ?? ticket.seq,
      });
    }

    log("checkin ok", { ticket_id: updated.id, event_detail_id: eventDetailId });
    return json({
      success: true,
      result: "ok",
      attendee: updated.attendee_name,
      seq: updated.seq,
      checked_in_at: updated.checked_in_at,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TICKET-CHECKIN] unexpected", msg);
    return json({ success: false, error: msg }, 500);
  }
});
