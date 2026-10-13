// HORECA-1 — staat de horeca-module aan voor deze winkel? Zit in geen standaardplan:
// een platformadmin ontgrendelt hem per winkel (slotje in de zijbalk, featureKey
// 'horeca'), of later via een horecaplan (pricing_plans.features.horeca). Winkels zonder
// de module zien niets van keuken, extra's, QR-menu of afhaaluren.
import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';

export const HORECA_FEATURE = 'horeca';

export function useHorecaModule(): boolean {
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription } = useTenantSubscription();
  if (isPlatformAdmin && isAdminView) return true;
  if (isFeatureGranted(HORECA_FEATURE)) return true;
  const features = subscription?.pricing_plan?.features as unknown as Record<string, unknown> | undefined;
  return features?.[HORECA_FEATURE] === true;
}
