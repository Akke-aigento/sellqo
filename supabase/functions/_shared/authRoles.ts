// HOTFIX-AUTH-1 — de rolbeslissing, los van Deno en los van de supabase-client.
//
// `requireRole` in _shared/auth.ts gooit; deze functie beslist alleen. Zo kan
// vitest de échte beslissing toetsen (auth.ts zelf is niet importeerbaar in de
// webbundel: remote imports en `Deno.*`), zonder een tweede kopie van de regels.

export interface RoleCheckInput {
  /** `service_role` is de interne aanroeper (cron, webhooks). */
  user_id: string;
  is_platform_admin: boolean;
  roles_by_tenant?: Record<string, string[]>;
}

/** Mag deze aanroeper een actie doen die één van `allowed` vereist, in deze winkel? */
export function hasRequiredRole(
  auth: RoleCheckInput,
  tenantId: string,
  allowed: readonly string[],
): boolean {
  if (auth.user_id === "service_role") return true;
  if (auth.is_platform_admin) return true;
  const roles = auth.roles_by_tenant?.[tenantId] ?? [];
  return roles.some((r) => allowed.includes(r));
}
