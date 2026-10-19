// SOCIAL-GATE-1 — Social (planning, resultaten, kanalen, "Post met AI") is nog geen feature voor
// externe winkels: koppelen met Instagram vraagt Meta-testerrollen zolang de Meta-app in
// Development mode staat. Zichtbaar enkel voor winkels die een platformadmin ontgrendelt
// (tenant_feature_overrides.granted_features bevat 'social_planner'; in de sidebar het slotje
// in beheerweergave) en voor platformadmins in beheerweergave. Geen plan bevat deze key.

import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';

export const SOCIAL_FEATURE_KEY = 'social_planner';

export function useSocialAccess(): { allowed: boolean; isLoading: boolean } {
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();
  const { isFeatureGranted, isLoading } = useTenantPageOverrides();
  if (isPlatformAdmin && isAdminView) return { allowed: true, isLoading: false };
  return { allowed: isFeatureGranted(SOCIAL_FEATURE_KEY), isLoading };
}
