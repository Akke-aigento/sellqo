import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface AuthResult {
  user_id: string;
  email: string;
  tenant_ids: string[];
  is_platform_admin: boolean;
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
  };
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