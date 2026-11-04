// UREN-1b — logo en merkkleur: één plek (Instellingen › Branding). Ze staan in tenant_theme_settings (website,
// mails via _shared/tenantEmail.ts) én in tenants (facturen, creditnota's, betaalverzoeken, kassabon, andere
// mails: generate-credit-note, generate-payment-request-pdf, create-manual-invoice, send-gift-card-email,
// send-customer-message, create-notification, token-wallet, kassa deviceAccount, …). Wie logo of merkkleur
// bewaart, schrijft beide met deze functie, zodat ze nooit uit elkaar lopen.
// Niet voor eigen frontends: daar blijft Branding schrijven wat het altijd schreef (eerste wet).
import { supabase } from '@/integrations/supabase/client';

export async function syncTenantBrand(tenantId: string, v: { logo_url?: string | null; brand_color?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if ('logo_url' in v) patch.logo_url = v.logo_url || null;
  if (v.brand_color && /^#[0-9a-f]{6}$/i.test(v.brand_color)) patch.primary_color = v.brand_color;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from('tenants').update(patch as never).eq('id', tenantId);
  if (error) throw error;
}

/** Lopen de twee bewaarplekken vandaag uiteen? (voor de melding in Branding) */
export function brandDiverges(theme: { logo_url?: string | null; brand_color?: string | null }, tenant: { logo_url?: string | null; primary_color?: string | null }) {
  const logo = (theme.logo_url || null) !== (tenant.logo_url || null);
  const color = !!theme.brand_color && (theme.brand_color || '').toLowerCase() !== (tenant.primary_color || '').toLowerCase();
  return { logo, color };
}
