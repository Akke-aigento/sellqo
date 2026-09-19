/**
 * TENANT-SWITCHER-1 — de winkelkiezer voor platform-admins in drie groepen.
 *
 * Volledig afgeleid, geen eigen kolom:
 *   - demo     → `tenants.is_demo = true` (wint, ook bij een eigen rol);
 *   - own      → de gebruiker heeft een eigen rij in `user_roles` voor die winkel;
 *   - clients  → alleen bereikbaar via platform_admin (die rij heeft tenant_id NULL).
 *
 * `is_internal_tenant` bewust niet: die stuurt Stripe/billing, niet de weergave.
 * Een gewone gebruiker krijgt `null` — de kiezer blijft dan zoals hij was.
 */

export type TenantGroupKey = 'own' | 'clients' | 'demo';

export interface GroupableTenant {
  id: string;
  name: string;
  is_demo?: boolean | null;
}

export interface TenantGroup<T extends GroupableTenant> {
  key: TenantGroupKey;
  tenants: T[];
}

const ORDER: TenantGroupKey[] = ['own', 'clients', 'demo'];

export function groupTenants<T extends GroupableTenant>(
  tenants: readonly T[],
  roles: ReadonlyArray<{ tenant_id: string | null }>,
  isPlatformAdmin: boolean,
): TenantGroup<T>[] | null {
  if (!isPlatformAdmin) return null;

  const ownIds = new Set(roles.map((r) => r.tenant_id).filter((id): id is string => !!id));
  const buckets: Record<TenantGroupKey, T[]> = { own: [], clients: [], demo: [] };
  for (const tenant of tenants) {
    const key: TenantGroupKey = tenant.is_demo ? 'demo' : ownIds.has(tenant.id) ? 'own' : 'clients';
    buckets[key].push(tenant);
  }

  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' });
  return ORDER
    .map((key) => ({ key, tenants: [...buckets[key]].sort(byName) }))
    .filter((group) => group.tenants.length > 0);
}
