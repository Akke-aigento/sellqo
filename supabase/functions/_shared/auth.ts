import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type AppRole =
  | "platform_admin"
  | "tenant_admin"
  | "accountant"
  | "staff"
  | "warehouse"
  | "viewer"
  | "marketing";

export interface AuthResult {
  user_id: string;
  email: string;
  tenant_ids: string[];
  is_platform_admin: boolean;
  /**
   * Fase 2 Foundation: per-tenant role map.
   * Optional for backwards compatibility — service-role bypass returns an
   * empty object. `requireRole` honours `is_platform_admin` as a bypass.
   */
  roles_by_tenant?: Record<string, AppRole[]>;
}

export async function authenticateRequest(
  req: Request,
  requiredTenantId?: string
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Service-role bypass: server-to-server calls are trusted
  if (serviceKey && token === serviceKey) {
    return {
      user_id: "service_role",
      email: "service_role@internal",
      tenant_ids: [],
      is_platform_admin: true,
      roles_by_tenant: {},
    };
  }

  // JWT verification
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new AuthError("Invalid or expired token", 401);
  }

  // Role & tenant lookup
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("[auth] Failed to fetch user roles:", rolesError);
    throw new AuthError("Failed to verify permissions", 500);
  }

  const isPlatformAdmin = (roles || []).some(
    (r: { role: string }) => r.role === "platform_admin"
  );

  const tenantIds = (roles || [])
    .filter((r: { tenant_id: string | null }) => r.tenant_id !== null)
    .map((r: { tenant_id: string }) => r.tenant_id);

  // Build per-tenant role map for Fase 2 Foundation requireRole helper.
  const rolesByTenant: Record<string, AppRole[]> = {};
  for (const r of (roles || []) as Array<{ role: AppRole; tenant_id: string | null }>) {
    if (!r.tenant_id) continue;
    const list = rolesByTenant[r.tenant_id] ?? [];
    if (!list.includes(r.role)) list.push(r.role);
    rolesByTenant[r.tenant_id] = list;
  }

  // Tenant access check
  if (requiredTenantId && !isPlatformAdmin) {
    if (!tenantIds.includes(requiredTenantId)) {
      throw new AuthError("No access to this tenant", 403);
    }
  }

  return {
    user_id: user.id,
    email: user.email || "",
    tenant_ids: tenantIds,
    is_platform_admin: isPlatformAdmin,
    roles_by_tenant: rolesByTenant,
  };
}

/**
 * Fase 2 Foundation: assert that `auth` has any of `allowed` roles within
 * `tenantId`. Throws AuthError(403) on mismatch.
 *
 * - Service-role calls (`auth.user_id === "service_role"`) bypass the check.
 * - Platform admins (`auth.is_platform_admin`) bypass the check.
 */
export function requireRole(
  auth: AuthResult,
  tenantId: string,
  allowed: AppRole[]
): void {
  if (auth.user_id === "service_role") return;
  if (auth.is_platform_admin) return;
  const roles = auth.roles_by_tenant?.[tenantId] ?? [];
  if (!roles.some((r) => allowed.includes(r))) {
    throw new AuthError("Insufficient role for this action", 403);
  }
}

export function authErrorResponse(
  err: AuthError,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ success: false, error: err.message }),
    {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}