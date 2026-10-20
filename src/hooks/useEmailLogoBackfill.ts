import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { emailLogoState, type EmailLogoState } from '@/lib/emailLogo';
import { fetchLogoFile, makeAndSaveEmailLogoVariant } from '@/hooks/useLogoUpload';

/**
 * MAIL-UX-1 — mailversie voor logo's die er al stonden vóór MAIL-LOGO-1.
 *
 * - useEmailLogoState: welk logo de mail nu toont en of er nog een mailversie van nodig is.
 * - useEmailLogoAutoBackfill: maakt die versie één keer stil op de achtergrond, zodra een
 *   beheerder van die winkel Marketing of Instellingen opent. Best effort: een fout ziet de
 *   gebruiker niet, en per winkel en logo-URL hooguit één poging per 7 dagen (localStorage).
 *
 * De knop (EmailLogoFromCurrentButton) volgt useCan('write', 'settings_general'), zoals de RLS
 * "Tenant admins can update their own tenant"; de stille backfill enkel een tenant_admin van de winkel.
 */
export function useEmailLogoState() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery<EmailLogoState | null>({
    queryKey: ['email-logo-state', tenantId],
    enabled: !!tenantId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!tenantId) return null;
      const [{ data: tenantRow, error: tErr }, { data: themeRow, error: thErr }] = await Promise.all([
        supabase.from('tenants').select('logo_url, email_logo_source_url').eq('id', tenantId).maybeSingle(),
        supabase.from('tenant_theme_settings').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
      ]);
      // Kan één van beide niet gelezen worden, dan weten we niet welk logo geldt: niets doen.
      if (tErr || thErr) throw new Error((tErr ?? thErr)?.message);
      return emailLogoState({
        themeLogo: themeRow?.logo_url,
        tenantLogo: tenantRow?.logo_url,
        emailLogoSource: tenantRow?.email_logo_source_url,
      });
    },
  });
}

/** Een poging (gelukt of niet) per winkel en logo-URL geldt 7 dagen; daarna mag het opnieuw. */
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const attempted = new Set<string>();

function alreadyTried(key: string): boolean {
  if (attempted.has(key)) return true;
  try {
    const at = Number(window.localStorage.getItem(key));
    return Number.isFinite(at) && at > 0 && Date.now() - at < RETRY_AFTER_MS;
  } catch {
    return false;
  }
}

function markTried(key: string) {
  attempted.add(key);
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // localStorage niet beschikbaar: het geheugen in deze tab volstaat
  }
}

export function useEmailLogoAutoBackfill() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  // Enkel een beheerder van déze winkel, niet een platformbeheerder die meekijkt: die zou
  // anders bij elke winkel die hij opent stil een logo laten herschrijven.
  const { roles } = useAuth();
  const isOwnTenantAdmin = !!tenantId
    && (roles ?? []).some((r) => r.role === 'tenant_admin' && r.tenant_id === tenantId);
  const { data: state } = useEmailLogoState();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId || !isOwnTenantAdmin || !state?.needsVariant) return;
    const key = `sellqo:email-logo-backfill:${tenantId}:${state.currentLogo}`;
    if (alreadyTried(key)) return;
    // Even wachten: de pagina zelf laadt eerst.
    const timer = window.setTimeout(async () => {
      if (alreadyTried(key)) return;
      markTried(key);
      try {
        const file = await fetchLogoFile(state.currentLogo);
        await makeAndSaveEmailLogoVariant(tenantId, file, state.currentLogo, state.target);
        queryClient.invalidateQueries({ queryKey: ['email-logo-state', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['tenant-brand', tenantId] });
      } catch (e) {
        // Bewust stil: de knop "Mailversie maken van je huidige logo" blijft staan.
        console.warn('[emailLogo] automatische mailversie mislukt', e);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [tenantId, isOwnTenantAdmin, state, queryClient]);
}
