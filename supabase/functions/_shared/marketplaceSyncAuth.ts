// CRON-AUTH-1 — wie mag een marketplace-sync starten?
//
// De sync-functies (sync-{bol,shopify,woocommerce,amazon,ebay}-{orders,inventory})
// hadden geen enkele controle en draaien zonder JWT-verificatie. Iedereen met de
// URL kon ze aanroepen: bol.com-aanroepen op het account van een winkel laten
// lopen, voorraad naar een marketplace duwen. Gevonden 13 sep 2026.
//
// Twee legitieme aanroepers:
//   1. De cron en andere functies (marketplace-sync-scheduler, trigger-manual-sync):
//      `x-cron-secret` of de service-key — zie cronAuth.ts.
//   2. De admin (MarketplaceDetail, useAutoSync, ConnectMarketplaceDialog) met de
//      JWT van de gebruiker. Die mag alleen een connectie van zijn eigen winkel
//      syncen, met leesrecht op `integrations` — gelijk aan de RouteGuard van
//      /admin/connect (keuze van Akke, 13 sep 2026).
//
// Zonder connectionId is een sync "alle connecties van alle winkels"; dat is
// alleen voor de cron.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAuthorizedCronRequest } from "./cronAuth.ts";
import { AuthError, authenticateRequest, requireRole } from "./auth.ts";

/** read-rollen van `integrations` in PERMISSION_MATRIX (src/hooks/useCan.ts). */
const SYNC_ROLES = ["tenant_admin", "viewer"] as const;

function deny(status: number, message: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * `null` als de aanroep door mag, anders de weigering om terug te geven.
 * Resolve-then-authorize: eerst de winkel van de connectie, dan de gebruiker.
 */
export async function authorizeMarketplaceSync(
  req: Request,
  admin: SupabaseClient,
  connectionId: string | null | undefined,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (await isAuthorizedCronRequest(req, admin)) return null;

  if (!connectionId) {
    return deny(401, "Unauthorized", corsHeaders);
  }

  const { data: connection, error } = await admin
    .from("marketplace_connections")
    .select("tenant_id")
    .eq("id", connectionId)
    .maybeSingle();

  // Zelfde antwoord bij "bestaat niet" als bij "geen toegang": anders verraadt
  // de functie welke connectie-id's er zijn.
  if (error || !connection?.tenant_id) {
    return deny(403, "No access to this connection", corsHeaders);
  }

  try {
    const auth = await authenticateRequest(req, connection.tenant_id);
    requireRole(auth, connection.tenant_id, [...SYNC_ROLES]);
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      return deny(e.status, e.status === 401 ? "Unauthorized" : "No access to this connection", corsHeaders);
    }
    throw e;
  }
}

/** Voor functies die alleen door de cron of een andere functie aangeroepen worden. */
export async function denyUnlessCron(
  req: Request,
  admin: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (await isAuthorizedCronRequest(req, admin)) return null;
  return deny(401, "Unauthorized", corsHeaders);
}
