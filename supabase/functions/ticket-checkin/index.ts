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
// Scanner-tokens zijn 32 random bytes als hex (zie event_scanner_access.access_token).
const SCANNER_TOKEN_RE = /^[a-f0-9]{64}$/;

type AppRoleLite =
  | "platform_admin" | "tenant_admin" | "accountant" | "staff" | "warehouse" | "viewer" | "marketing";

// Minimale vorm die deze function van een auth-object nodig heeft. In JWT-modus
// komt dit uit authenticateRequest; in token-modus bouwen we het zelf op.
// _shared/auth.ts blijft ongemoeid.
interface CheckinAuth {
  user_id: string | null;
  tenant_ids: string[];
  is_platform_admin: boolean;
  roles_by_tenant?: Record<string, AppRoleLite[]>;
}

interface ScannerContext {
  id: string;
  tenant_id: string;
  event_detail_id: string;
  zone_id: string;
  direction: string;
  scan_mode: string;
  allowed_product_ids: string[] | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // De body wordt bewust VÓÓR de auth gelezen: de modus-keuze hangt ervan af.
    const body = await req.json().catch(() => ({}));

    // Token-modus: header heeft voorrang, body is fallback. Nooit via URL.
    const scannerToken = String(
      req.headers.get("x-scanner-token") ?? (body as { scanner_token?: unknown })?.scanner_token ?? "",
    ).trim();
    const tokenMode = scannerToken.length > 0;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Eén generieke afwijzing voor onbekend / inactief / verlopen — geen orakel.
    const tokenRejected = () => json({ success: false, error: "invalid scanner token" }, 401);

    let auth: CheckinAuth;
    let scanner: ScannerContext | null = null;

    if (tokenMode) {
      if (!SCANNER_TOKEN_RE.test(scannerToken)) return tokenRejected();

      const { data: row, error: sErr } = await admin
        .from("event_scanner_access")
        .select("id, tenant_id, event_detail_id, zone_id, direction, scan_mode, allowed_product_ids, is_active, expires_at, use_count")
        .eq("access_token", scannerToken)
        .eq("is_active", true)
        .maybeSingle();

      if (sErr) {
        console.error("[TICKET-CHECKIN] scanner lookup failed", sErr.message ?? JSON.stringify(sErr));
        return json({ success: false, error: "scanner lookup failed" }, 500);
      }
      if (!row) return tokenRejected();
      if (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now()) return tokenRejected();

      scanner = {
        id: row.id as string,
        tenant_id: row.tenant_id as string,
        event_detail_id: row.event_detail_id as string,
        zone_id: row.zone_id as string,
        direction: String(row.direction ?? "in"),
        scan_mode: String(row.scan_mode ?? "check_in"),
        allowed_product_ids: (row.allowed_product_ids as string[] | null) ?? null,
      };

      // Crew-rechten, nooit host: undo blijft daardoor automatisch 403.
      auth = {
        user_id: null,
        tenant_ids: [scanner.tenant_id],
        is_platform_admin: false,
        roles_by_tenant: { [scanner.tenant_id]: ["staff"] },
      };

      // Telemetrie, best-effort: mag een scan nooit tegenhouden.
      void admin
        .from("event_scanner_access")
        .update({ last_used_at: new Date().toISOString(), use_count: ((row.use_count as number) ?? 0) + 1 })
        .eq("id", scanner.id)
        .then(({ error }) => {
          if (error) console.error("[TICKET-CHECKIN] token telemetry failed", error.message ?? JSON.stringify(error));
        });
    } else {
      auth = await authenticateRequest(req);
    }

    const qrToken = String(body?.qr_token ?? "").trim();
    // ANTI-TAMPERING: in token-modus komt het event UITSLUITEND uit de DB-rij.
    const eventDetailId = scanner ? scanner.event_detail_id : String(body?.event_detail_id ?? "").trim();
    const action = String(body?.action ?? "checkin");

    if (!TOKEN_RE.test(qrToken)) return json({ success: false, error: "invalid qr_token" }, 400);
    if (!eventDetailId) return json({ success: false, error: "event_detail_id required" }, 400);
    if (action !== "checkin" && action !== "undo") {
      return json({ success: false, error: "invalid action" }, 400);
    }

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
      .select("id, qr_token, status, checked_in_at, checked_in_by, event_detail_id, attendee_name, seq, tenant_id, product_id")
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

    // Zone: in token-modus uit de token-rij, anders de default-zone van het event.
    let zoneId: string | null = null;
    if (scanner) {
      zoneId = scanner.zone_id;
    } else {
      const { data: defaultZone } = await admin
        .from("event_zones")
        .select("id")
        .eq("event_detail_id", eventDetailId)
        .eq("tenant_id", tenantId)
        .eq("is_default", true)
        .maybeSingle();
      zoneId = (defaultZone?.id as string | undefined) ?? null;
    }
    const actorId = !auth.user_id || auth.user_id === "service_role" ? null : auth.user_id;
    const scannerAccessId = scanner?.id ?? null;

    // Richting: JWT-modus blijft altijd 'in'. Token-modus volgt de token-rij,
    // waarbij 'both' defaultet op 'in' (tenzij het een check-out-scanner is).
    const direction = scanner
      ? scanner.direction === "out"
        ? "out"
        : scanner.direction === "both" && scanner.scan_mode === "check_out"
          ? "out"
          : scanner.scan_mode === "check_out"
            ? "out"
            : "in"
      : "in";

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

      // Dubbele trail: scan-log krijgt een out/undo-rij zodat occupancy klopt.
      const { error: scanErr } = await admin.from("ticket_scans").insert({
        tenant_id: tenantId,
        ticket_instance_id: ticket.id,
        event_detail_id: eventDetailId,
        zone_id: zoneId,
        scanned_by_user_id: actorId,
        direction: "out",
        result: "undo",
      });
      if (scanErr) console.error("[TICKET-CHECKIN] undo scan log failed", scanErr.message ?? JSON.stringify(scanErr));

      log("undo ok", { ticket_id: ticket.id, by: auth.user_id });
      return json({ success: true, result: "undone", attendee: ticket.attendee_name, seq: ticket.seq });
    }

    // --- checkin via de engine (scan-log leidend, status dual-write) ---
    const { data: scan, error: cErr } = await admin.rpc("perform_scan", {
      p_ticket_id: ticket.id,
      p_event_detail_id: eventDetailId,
      p_zone_id: zoneId,
      p_direction: "in",
      p_scanner_access_id: null,
      p_scanned_by_user_id: actorId,
      p_device_id: null,
    });

    if (cErr) {
      console.error("[TICKET-CHECKIN] checkin failed", cErr.message ?? JSON.stringify(cErr));
      return json({ success: false, error: "check-in failed" }, 500);
    }

    const s = (scan ?? {}) as {
      result?: string;
      reason?: string;
      attendee?: string | null;
      seq?: number | null;
      checked_in_at?: string | null;
    };

    // COMPAT-mapping naar de bestaande PWA-codes.
    const result = s.result === "already_inside" ? "already" : String(s.result ?? "invalid");

    log("checkin result", { ticket_id: ticket.id, event_detail_id: eventDetailId, result });
    return json({
      success: true,
      result,
      ...(s.reason ? { reason: s.reason } : {}),
      attendee: s.attendee ?? ticket.attendee_name,
      seq: s.seq ?? ticket.seq,
      checked_in_at: s.checked_in_at ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TICKET-CHECKIN] unexpected", msg);
    return json({ success: false, error: msg }, 500);
  }
});
