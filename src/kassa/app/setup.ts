// KASSA-START-1 — wie mag vanuit de kassa-app een kassa aanmaken? Dezelfde regel als de RLS-policy
// pos_terminals_insert: platformbeheer, of tenant_admin van déze zaak. Puur, zodat het testbaar is.
export interface RoleRow { role: string; tenant_id: string | null }

export function canCreateTerminal(roles: RoleRow[] | null | undefined, tenantId: string, isPlatformAdmin: boolean): boolean {
  if (isPlatformAdmin) return true;
  return (roles ?? []).some((r) => r.role === 'tenant_admin' && r.tenant_id === tenantId);
}
