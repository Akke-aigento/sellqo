/**
 * TENANT-SWITCHER-1 — de winkelkiezer voor platform-admins in drie groepen.
 *
 *   - demo     → `tenants.is_demo = true` (wint, ook bij een interne winkel);
 *   - own      → `tenants.is_internal_tenant` of `tenants.billing_exempt` (BILLING-EXEMPT-1);
 *   - clients  → al het overige.
 *
 * TENANT-INTERNAL-1 (28-09): eerst kwam "Mijn winkels" uit de eigen rijen in
 * `user_roles`, omdat `is_internal_tenant` toen geen schakelaar had en dus niet
 * te vertrouwen was als signaal. Sinds die schakelaar bestaat is de vlag de
 * expliciete bron, en de afgeleide versie liep er aantoonbaar naast: Studio
 * Akke (intern, geen rol) stond bij de klanten en The Fonske Crawl (rol, niet
 * intern) bij de eigen winkels. Keuze Akke: alleen de vlag telt.
 *
 * BILLING-EXEMPT-1 (01-10): die vlag is nu `billing_exempt` ("geen SellQo-facturatie");
 * `is_internal_tenant` betekent alleen nog SellQo zelf en telt ook als eigen winkel.
 *
 * Een gewone gebruiker krijgt `null` — de kiezer blijft dan zoals hij was.
 */

import { isBillingExempt } from '../../supabase/functions/_shared/billingExempt';

export type TenantGroupKey = 'own' | 'clients' | 'demo';

export interface GroupableTenant {
  id: string;
  name: string;
  is_demo?: boolean | null;
  is_internal_tenant?: boolean | null;
  billing_exempt?: boolean | null;
}

export interface TenantGroup<T extends GroupableTenant> {
  key: TenantGroupKey;
  tenants: T[];
}

const ORDER: TenantGroupKey[] = ['own', 'clients', 'demo'];

export function groupTenants<T extends GroupableTenant>(
  tenants: readonly T[],
  isPlatformAdmin: boolean,
): TenantGroup<T>[] | null {
  if (!isPlatformAdmin) return null;

  const buckets: Record<TenantGroupKey, T[]> = { own: [], clients: [], demo: [] };
  for (const tenant of tenants) {
    const key: TenantGroupKey = tenant.is_demo ? 'demo' : isBillingExempt(tenant) ? 'own' : 'clients';
    buckets[key].push(tenant);
  }

  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' });
  return ORDER
    .map((key) => ({ key, tenants: [...buckets[key]].sort(byName) }))
    .filter((group) => group.tenants.length > 0);
}
