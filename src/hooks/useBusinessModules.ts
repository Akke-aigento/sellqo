// MODULES-1 — sectormodules per winkel (horeca, events).
// SellQo is één kern met sectormodules erbovenop. Een module staat aan als:
//  - de winkel hem zelf gekozen heeft (tenants.business_modules: onboarding of Instellingen),
//  - een platformadmin hem ontgrendeld heeft (tenant_feature_overrides.granted_features),
//  - of het plan hem bevat (pricing_plans.features.<module>, bv. het Horeca-plan).
// Platformadmins in beheerweergave zien alles. Winkels zonder de module zien er niets van.
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useTenant } from '@/hooks/useTenant';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';

export const BUSINESS_MODULES = ['horeca', 'events'] as const;
export type BusinessModule = (typeof BUSINESS_MODULES)[number];

export const isBusinessModule = (key: string | undefined): key is BusinessModule =>
  !!key && (BUSINESS_MODULES as readonly string[]).includes(key);

/** De modules die de winkel zelf gekozen heeft (zonder plan of admin-ontgrendeling). */
export function tenantModules(tenant: unknown): BusinessModule[] {
  const raw = (tenant as { business_modules?: string[] | null } | null)?.business_modules;
  return (raw || []).filter(isBusinessModule);
}

export function useBusinessModules() {
  const { t } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const { currentTenant, refreshTenants } = useTenant();
  const [saving, setSaving] = useState(false);
  const chosen = tenantModules(currentTenant);

  const has = useCallback((m: BusinessModule): boolean => {
    if (isPlatformAdmin && isAdminView) return true;
    if (chosen.includes(m)) return true;
    if (isFeatureGranted(m)) return true;
    const features = subscription?.pricing_plan?.features as unknown as Record<string, unknown> | undefined;
    return features?.[m] === true;
  }, [isPlatformAdmin, isAdminView, chosen, isFeatureGranted, subscription]);

  /** Zet een module aan of uit voor deze winkel (tenant_admin mag zijn eigen winkel bijwerken). */
  const setModule = useCallback(async (m: BusinessModule, on: boolean) => {
    if (!currentTenant?.id) return false;
    const next = on ? [...new Set([...chosen, m])] : chosen.filter((x) => x !== m);
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ business_modules: next }).eq('id', currentTenant.id);
    setSaving(false);
    if (error) { toast.error(t('admin.modules.save_failed')); return false; }
    await refreshTenants();
    return true;
  }, [currentTenant?.id, chosen, refreshTenants, t]);

  return { has, chosen, setModule, saving };
}
