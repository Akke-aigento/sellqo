import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';

/**
 * PERM-1 — per-gebruiker rechten die bovenop `PERMISSION_MATRIX` komen.
 *
 * Bewust GEEN uitbreiding van `useCan`: die hook is synchroon en wordt overal
 * gebruikt; een async grant-lookup erin bouwen raakt de hele applicatie.
 * Deze hook is een aanvullende check náást `useCan`.
 *
 * Stijl volgt `useTeamMembers.ts`: useState + useEffect + useCallback, geen react-query.
 */
export function usePermissionGrants() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [grants, setGrants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGrants = useCallback(async () => {
    if (!currentTenant?.id || !user?.id) {
      setGrants([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permission_grants')
        .select('resource')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id);

      if (error) throw error;
      setGrants((data ?? []).map((row) => row.resource));
    } catch (error) {
      console.error('Error fetching permission grants:', error);
      setGrants([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const hasGrant = useCallback(
    (resource: string) => grants.includes(resource),
    [grants],
  );

  return { grants, hasGrant, isLoading, refetch: fetchGrants };
}

/**
 * PERM-1 — mag de huidige gebruiker kortingscodes schrijven?
 *
 * `marketing` heeft daarvoor een expliciete grant nodig (RLS dwingt dit ook af);
 * `tenant_admin`, `staff` en `platform_admin` behouden het onvoorwaardelijk.
 */
export function useCanWriteDiscountCodes(): { allowed: boolean; needsGrant: boolean; isLoading: boolean } {
  const { roles, rolesLoading } = useAuth();
  const { currentTenant } = useTenant();
  const { hasGrant, isLoading } = usePermissionGrants();

  const scoped = (roles ?? []).filter((r) => {
    if (r.role === 'platform_admin') return true;
    if (r.tenant_id == null) return true;
    if (!currentTenant?.id) return false;
    return r.tenant_id === currentTenant.id;
  });
  const flat = scoped.map((r) => r.role as string);

  const unconditional = flat.some((r) =>
    ['platform_admin', 'tenant_admin', 'staff'].includes(r),
  );
  const isMarketing = flat.includes('marketing');

  if (unconditional) return { allowed: true, needsGrant: false, isLoading: false };

  if (isMarketing) {
    return {
      allowed: hasGrant('discount_codes'),
      needsGrant: !isLoading && !hasGrant('discount_codes'),
      isLoading: isLoading || rolesLoading,
    };
  }

  return { allowed: false, needsGrant: false, isLoading: rolesLoading };
}