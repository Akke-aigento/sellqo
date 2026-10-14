// HORECA-1 / MODULES-1 — staat de horeca-module aan voor deze winkel?
// Zie useBusinessModules: zelf gekozen, door een platformadmin ontgrendeld (slotje in de
// zijbalk, featureKey 'horeca'), of via het Horeca-plan. Winkels zonder de module zien
// niets van keuken, extra's, QR-menu of afhaaluren.
import { useBusinessModules } from '@/hooks/useBusinessModules';

export const HORECA_FEATURE = 'horeca';

export function useHorecaModule(): boolean {
  return useBusinessModules().has('horeca');
}
