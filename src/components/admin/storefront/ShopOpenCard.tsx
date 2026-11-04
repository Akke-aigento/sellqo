// SHOP-OPEN-1 — de winkel zelf online zetten op <slug>.sellqo.shop en online bestellen
// aanzetten. Vervangt de pilotlijst in de shop. Een korte checklist toont wat er nog
// ontbreekt, maar blokkeert niet: de winkel beslist zelf.
import { CheckCircle2, CircleAlert, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/hooks/useTenant';
import { useFrontendMode } from '@/hooks/useFrontendMode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// HORECA-NU-1: stand en schrijven in useShopOpen (gedeeld met de tegel "Online bestellen" op het Nu-paneel).
import { useShopOpen, type ShopOpenPatch } from './useShopOpen';

// UREN-1b — `site`: horecazaak zonder webshop: "website" en "kaart" in plaats van "winkel" en "producten".
export function ShopOpenCard({ site = false }: { site?: boolean } = {}) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { isCustomFrontend } = useFrontendMode();
  const { data, isLoading, save: saveState, saving } = useShopOpen();

  const save = async (patch: ShopOpenPatch) => {
    const r = await saveState(patch);
    if (r.ok === false) {
      toast.error(r.reason === 'no_permission' ? t('common.saveNoPermission') : t('admin.storefront.food.save_failed_reason', { reason: r.message ?? '' }));
      return;
    }
    toast.success(patch.shop_live === true ? t(site ? 'admin.storefront.shopOpenCard.site_online' : 'admin.storefront.shopOpenCard.je_winkel_staat_online') : patch.shop_live === false ? t(site ? 'admin.storefront.shopOpenCard.site_offline' : 'admin.storefront.shopOpenCard.je_winkel_staat_offline') : patch.shop_ordering ? t('admin.storefront.shopOpenCard.online_bestellen_staat_aan') : t('admin.storefront.shopOpenCard.online_bestellen_staat_uit'));
  };

  if (isLoading || !data) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;

  const checks = [
    { ok: data.products > 0, text: data.products > 0 ? t(site ? 'admin.storefront.shopOpenCard.menu_items' : 'admin.storefront.shopOpenCard.active_products', { count: data.products }) : t(site ? 'admin.storefront.shopOpenCard.no_menu_items' : 'admin.storefront.shopOpenCard.no_active_products') },
    { ok: data.payments, text: data.payments ? t('admin.storefront.shopOpenCard.betaalmethode_ingesteld') : t('admin.storefront.shopOpenCard.nog_geen_betaalmethode_stripe_overschrijving_of') },
    { ok: data.legal > 0, text: data.legal > 0 ? t('admin.storefront.shopOpenCard.juridische_pagina_s_aanwezig') : t('admin.storefront.shopOpenCard.nog_geen_algemene_voorwaarden_en_privacybeleid') },
  ];

  return (
    <Card className={cn(data.shop_live && 'border-emerald-500/50')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" />{data.shop_live ? t(site ? 'admin.storefront.shopOpenCard.site_online' : 'admin.storefront.shopOpenCard.je_winkel_staat_online') : t(site ? 'admin.storefront.shopOpenCard.site_open' : 'admin.orderingHub.winkel_openen')}</CardTitle>
        <CardDescription>
          {data.shop_live
            ? t(site ? 'admin.storefront.shopOpenCard.live_desc_site' : 'admin.storefront.shopOpenCard.live_desc', { domain: `${currentTenant?.slug}.sellqo.shop` })
            : t(site ? 'admin.storefront.shopOpenCard.closed_desc_site' : 'admin.storefront.shopOpenCard.closed_desc')}
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
            <Label htmlFor="shop-live" className="font-medium">{t(site ? 'admin.storefront.shopOpenCard.site_live_label' : 'admin.orderingHub.winkel_online')}</Label>
            <Switch id="shop-live" checked={data.shop_live} disabled={saving} onCheckedChange={(v) => save({ shop_live: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="shop-order" className="font-medium">{t('admin.orderingHub.online_bestellen')}</Label>
              <p className="text-xs text-muted-foreground">{t(site ? 'admin.storefront.shopOpenCard.ordering_desc_site' : 'admin.storefront.shopOpenCard.klanten_kunnen_afrekenen_uit_je_winkel')}</p>
            </div>
            <Switch id="shop-order" checked={data.shop_ordering} disabled={saving || !data.shop_live} onCheckedChange={(v) => save({ shop_ordering: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
