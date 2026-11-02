/* eslint-disable @typescript-eslint/no-explicit-any -- supabase-client zonder gegenereerde types in edge functions */
// KASSA-ACCOUNT-1 — toegang voor een gekoppeld kassatoestel in een edge function.
//
// Een kassatoestel heeft een eigen auth-user die NIET in user_roles staat (zie migratie
// 20261102100000_kassa_account_1.sql). authenticateRequest geeft voor zo'n user dus geen winkels terug.
// Deze helper laat naast de bestaande rollen ook een niet-ingetrokken toestel van précies deze winkel toe.
// Bewust een apart bestand: _shared/auth.ts wordt door tientallen functies gedeeld; dit enkel door
// horeca-receipt-mail en send-order-ready (en kassa-device-revoke niet: daar mag enkel de eigenaar).
import { AuthError, type AppRole, type AuthResult } from "./auth.ts";
import { hasRequiredRole } from "./authRoles.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export type KassaAccess = "role" | "device";

/** Zit de aanroeper (al geauthenticeerd) in een van de rollen van deze winkel, of is het een gekoppeld
 *  kassatoestel van deze winkel? `allowed = null` = elk lid van de winkel (zoals authenticateRequest(req, tenantId)).
 *  Gooit AuthError(403) anders. */
export async function requireRoleOrKassaDevice(
  auth: AuthResult,
  db: Db,
  tenantId: string,
  allowed: AppRole[] | null,
): Promise<KassaAccess> {
  if (allowed ? hasRequiredRole(auth, tenantId, allowed) : (auth.is_platform_admin || auth.tenant_ids.includes(tenantId))) {
    return "role";
  }
  if (auth.user_id && auth.user_id !== "service_role") {
    const { data } = await db.from("kassa_device_accounts").select("tenant_id")
      .eq("user_id", auth.user_id).is("revoked_at", null).maybeSingle();
    if ((data as { tenant_id?: string } | null)?.tenant_id === tenantId) return "device";
  }
  throw new AuthError(allowed ? "Insufficient role for this action" : "No access to this tenant", 403);
}
