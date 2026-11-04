// UREN-1b — logo en merkkleur: één plek (Instellingen › Branding). Ze staan in tenant_theme_settings (website,
// mails via _shared/tenantEmail.ts) én in tenants (facturen, creditnota's, betaalverzoeken, kassabon, andere
// mails: generate-credit-note, generate-payment-request-pdf, create-manual-invoice, send-gift-card-email,
// send-customer-message, create-notification, token-wallet, kassa deviceAccount, …). Wie logo of merkkleur
// bewaart, schrijft beide met deze functie, zodat ze nooit uit elkaar lopen.
// Niet voor eigen frontends: daar blijft Branding schrijven wat het altijd schreef (eerste wet).
import { supabase } from '@/integrations/supabase/client';
import { assertRowsWritten } from '@/lib/supabaseWriteGuard';

/**
 * Schrijft logo en/of merkkleur ook naar tenants (facturen, mails, kassabon).
 * UREN-1c:
 *  - Het logo gaat enkel mee als het ingevuld is. Een leeg formulierlogo wist tenants.logo_url nooit stil
 *    (bv. een zaak met enkel een factuurlogo); wissen gebeurt alleen na "Logo verwijderen" (`clear_logo`).
 *  - .select('id'): 0 rijen (RLS, geen beheerder) is een fout, geen stil "opgeslagen" (HONEST-SAVE-1).
 */
export async function syncTenantBrand(
  tenantId: string,
  v: { logo_url?: string | null; brand_color?: string | null; clear_logo?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (v.logo_url) patch.logo_url = v.logo_url;
  else if (v.clear_logo === true) patch.logo_url = null;
  if (v.brand_color && /^#[0-9a-f]{6}$/i.test(v.brand_color)) patch.primary_color = v.brand_color;
  if (!Object.keys(patch).length) return;
  const { data, error } = await supabase.from('tenants').update(patch as never).eq('id', tenantId).select('id');
  if (error) throw error;
  assertRowsWritten(data);
}

/** Lopen de twee bewaarplekken vandaag uiteen? (voor de melding in Branding) */
export function brandDiverges(theme: { logo_url?: string | null; brand_color?: string | null }, tenant: { logo_url?: string | null; primary_color?: string | null }) {
  // UREN-1c: zonder websitelogo zet Bewaren niets op de facturen (een leeg logo wist nooit stil), dus dan ook
  // geen melding die belooft dat alles hetzelfde logo krijgt.
  const logo = !!theme.logo_url && theme.logo_url !== (tenant.logo_url || null);
  const color = !!theme.brand_color && (theme.brand_color || '').toLowerCase() !== (tenant.primary_color || '').toLowerCase();
  return { logo, color };
}
