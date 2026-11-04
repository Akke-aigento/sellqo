// HORECA-INSTELLINGEN-1 — wie mag welke tab van Mijn zaak, Personeel of een zoekresultaat openen.
// Zelfde regels als de oude plekken: het leesrecht uit de permissiematrix (useCan), "enkel zaakvoerder"
// zoals de oude adminOnly-secties, en de plan-features zoals Instellingen ze al toetste.
import { useCallback } from 'react';
import { canWithRoles, useScopedRoles, type Resource } from '@/hooks/useCan';
import { useAuth } from '@/hooks/useAuth';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';

export interface AccessRule { requiredRead?: Resource; adminOnly?: boolean; featureKey?: string }

/**
 * Plan-feature van een instellingenscherm: in beheerweergave of ontgrendeld altijd, anders volgens het
 * plan; zonder plan-features (nog aan het laden) zichtbaar. Eén plek voor Instellingen en Mijn zaak.
 */
export function useSettingsFeatureVisible() {
  const { roles } = useAuth();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  const isPlatformAdmin = roles.some((r) => r.role === 'platform_admin');
  const isAdminView = isPlatformAdmin && sessionStorage.getItem('admin_view_mode') === 'true';
  return useCallback((featureKey?: string): boolean => {
    if (!featureKey) return true;
    if (isAdminView) return true;
    if (isFeatureGranted(featureKey)) return true;
    const features = subscription?.pricing_plan?.features as unknown as Record<string, boolean> | undefined;
    if (!features) return true;
    return features[featureKey] !== false;
  }, [isAdminView, isFeatureGranted, subscription]);
}

export function useZaakAccess() {
  const scoped = useScopedRoles();
  const featureVisible = useSettingsFeatureVisible();
  const roles = scoped ?? [];
  const isAdmin = roles.includes('tenant_admin') || roles.includes('platform_admin');
  return useCallback((rule: AccessRule): boolean => {
    if (scoped === null) return false;
    if (rule.adminOnly && !isAdmin) return false;
    if (rule.requiredRead && !canWithRoles(roles, 'read', rule.requiredRead)) return false;
    return featureVisible(rule.featureKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roles volgt uit scoped
  }, [scoped, isAdmin, featureVisible]);
}
