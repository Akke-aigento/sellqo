// SHOP-OPEN-1 — de winkel zelf online zetten op <slug>.sellqo.shop en online bestellen
// aanzetten. Vervangt de pilotlijst in de shop. Een korte checklist toont wat er nog
// ontbreekt, maar blokkeert niet: de winkel beslist zelf.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface OpenState { shop_live: boolean; shop_ordering: boolean; products: number; legal: number; payments: boolean }

export function ShopOpenCard() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { isCustomFrontend } = useFrontendMode();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['shop-open', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<OpenState> => {
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

  const save = async (patch: Partial<Pick<OpenState, 'shop_live' | 'shop_ordering'>>) => {
    if (!tenantId) return;
    setSaving(true);
    const row = {
      tenant_id: tenantId, ...patch,
      ...(patch.shop_live === true ? { shop_live_at: new Date().toISOString() } : {}),
      ...(patch.shop_live === false ? { shop_ordering: false } : {}),
    };
    // HONEST-SAVE-1: zonder .select() meldde een door RLS geweigerde upsert "online".
    const { data: written, error } = await supabase.from('tenant_theme_settings').upsert(row, { onConflict: 'tenant_id' }).select('id');
    setSaving(false);
    if (error) { toast.error(t('admin.storefront.food.save_failed_reason', { reason: error.message })); return; }
    if (!written || written.length === 0) { toast.error(t('common.saveNoPermission')); return; }
    toast.success(patch.shop_live === true ? t('admin.storefront.shopOpenCard.je_winkel_staat_online') : patch.shop_live === false ? t('admin.storefront.shopOpenCard.je_winkel_staat_offline') : patch.shop_ordering ? t('admin.storefront.shopOpenCard.online_bestellen_staat_aan') : t('admin.storefront.shopOpenCard.online_bestellen_staat_uit'));
    await qc.invalidateQueries({ queryKey: ['shop-open', tenantId] });
  };

  if (isLoading || !data) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  const checks = [
    { ok: data.products > 0, text: data.products > 0 ? t('admin.storefront.shopOpenCard.active_products', { count: data.products }) : t('admin.storefront.shopOpenCard.no_active_products') },
    { ok: data.payments, text: data.payments ? t('admin.storefront.shopOpenCard.betaalmethode_ingesteld') : t('admin.storefront.shopOpenCard.nog_geen_betaalmethode_stripe_overschrijving_of') },
    { ok: data.legal > 0, text: data.legal > 0 ? t('admin.storefront.shopOpenCard.juridische_pagina_s_aanwezig') : t('admin.storefront.shopOpenCard.nog_geen_algemene_voorwaarden_en_privacybeleid') },
  ];

  return (
    <Card className={cn(data.shop_live && 'border-emerald-500/50')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" />{data.shop_live ? t('admin.storefront.shopOpenCard.je_winkel_staat_online') : t('admin.orderingHub.winkel_openen')}</CardTitle>
        <CardDescription>
          {data.shop_live
            ? t('admin.storefront.shopOpenCard.live_desc', { domain: `${currentTenant?.slug}.sellqo.shop` })
            : t('admin.storefront.shopOpenCard.closed_desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCustomFrontend && !data.shop_live ? (
          <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">
            {t('admin.storefront.shopOpenCard.je_hebt_ook_een_eigen_website')}
          </p>
        ) : null}
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.text} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}
              <span className={c.ok ? '' : 'text-muted-foreground'}>{c.text}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="shop-live" className="font-medium">{t('admin.orderingHub.winkel_online')}</Label>
            <Switch id="shop-live" checked={data.shop_live} disabled={saving} onCheckedChange={(v) => save({ shop_live: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="shop-order" className="font-medium">{t('admin.orderingHub.online_bestellen')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.storefront.shopOpenCard.klanten_kunnen_afrekenen_uit_je_winkel')}</p>
            </div>
            <Switch id="shop-order" checked={data.shop_ordering} disabled={saving || !data.shop_live} onCheckedChange={(v) => save({ shop_ordering: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
