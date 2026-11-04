// UREN-1 — openingsuren van de huidige zaak (één bron voor Instellingen › Bedrijf, afhalen/leveren en
// online reserveren). Zelfde query-key overal, zodat bewaren elk scherm meteen bijwerkt.
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { fetchBusinessHours } from '@/lib/businessHours';

export const businessHoursKey = (tenantId: string | undefined) => ['business-hours', tenantId];

export function useBusinessHours() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({ queryKey: businessHoursKey(tenantId), enabled: !!tenantId, queryFn: () => fetchBusinessHours(tenantId!) });
}
