// HORECA-NU-1 — de stand en de schrijflogica van "Winkel openen" (SHOP-OPEN-1), los van de kaart, zodat
// ShopOpenCard (Website/Webshop) en de tegel "Online bestellen" op het Nu-paneel één bron delen.
// Zelfde query-sleutel ['shop-open', tenantId]: wie de ene wijzigt, ververst de andere.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { horecaOrdersNavKey } from '@/components/admin/sidebar/useHorecaOrdersNav';

export interface ShopOpenState { shop_live: boolean; shop_ordering: boolean; products: number; legal: number; payments: boolean }
export type ShopOpenPatch = Partial<Pick<ShopOpenState, 'shop_live' | 'shop_ordering'>>;
export type ShopOpenSaveResult = { ok: true } | { ok: false; reason: 'no_permission' | 'error'; message?: string };

export const shopOpenKey = (tenantId: string | undefined) => ['shop-open', tenantId] as const;

/** Waarom online bestellen (nog) niet aan kan, of null. De winkel moet online staan en kunnen laten betalen. */
export function orderingBlocker(s: Pick<ShopOpenState, 'shop_live' | 'payments'>): 'offline' | 'no_payments' | null {
  if (!s.shop_live) return 'offline';
  if (!s.payments) return 'no_payments';
  return null;
}

export function useShopOpen() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: shopOpenKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<ShopOpenState> => {
      const [ts, products, legal, fs] = await Promise.all([
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('is_active', true),
        supabase.from('legal_pages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!),
        supabase.from('fulfillment_settings').select('pay_on_pickup').eq('tenant_id', tenantId!).maybeSingle(),
      ]);
      const t = currentTenant as { stripe_charges_enabled?: boolean; iban?: string | null; payment_methods_enabled?: unknown } | null;
      const enabled = Array.isArray(t?.payment_methods_enabled) ? (t?.payment_methods_enabled as string[]) : [];
      const payments = !!t?.stripe_charges_enabled || (!!t?.iban && enabled.includes('bank_transfer')) || !!fs.data?.pay_on_pickup;
      return {
        shop_live: !!ts.data?.shop_live, shop_ordering: !!ts.data?.shop_ordering,
        products: products.count ?? 0, legal: legal.count ?? 0, payments,
      };
    },
  });

  const save = async (patch: ShopOpenPatch): Promise<ShopOpenSaveResult> => {
    if (!tenantId) return { ok: false, reason: 'error' };
    setSaving(true);
    const row = {
      tenant_id: tenantId, ...patch,
      ...(patch.shop_live === true ? { shop_live_at: new Date().toISOString() } : {}),
      ...(patch.shop_live === false ? { shop_ordering: false } : {}),
    };
    // HONEST-SAVE-1: zonder .select() meldde een door RLS geweigerde upsert "online".
    const { data: written, error } = await supabase.from('tenant_theme_settings').upsert(row, { onConflict: 'tenant_id' }).select('id');
    setSaving(false);
    if (error) return { ok: false, reason: 'error', message: error.message };
    if (!written || written.length === 0) return { ok: false, reason: 'no_permission' };
    await qc.invalidateQueries({ queryKey: shopOpenKey(tenantId) });
    // QR-REKENING-1b — de QR-instellingen tonen of het menu zichtbaar is.
    await qc.invalidateQueries({ queryKey: ['qr-mode', tenantId] });
    // HORECA-NU-1 — de pauzeknop hangt af van online bestellen.
    await qc.invalidateQueries({ queryKey: ['kitchen-pause', tenantId] });
    // ZIJBALK-BESTELLINGEN-1 — Bestellingen in de horeca-zijbalk hangt af van online bestellen.
    await qc.invalidateQueries({ queryKey: horecaOrdersNavKey(tenantId) });
    return { ok: true };
  };

  return { ...query, save, saving };
}
