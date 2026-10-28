// HORECA-1 — "Bestellen": één plek voor de twee manieren waarop klanten bestellen.
//   1. Webshop — thuis bestellen: afhalen of laten leveren (<winkel>.sellqo.shop)
//   2. QR-menu — in de zaak: menukaart bekijken of bestellen aan tafel (/menu?t=<token> per
//      tafel uit het zaalplan, ZAAL-H1; zonder zaalplan nog /menu?tafel=N)
// Producten, extra's en keuken zijn gedeeld. Alleen met de horeca-module.
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bike, BookOpen, ChefHat, ExternalLink, Globe, Pizza, QrCode, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FulfillmentSettings } from '@/components/admin/storefront/food/FulfillmentSettings';
import { AddonGroupsManager } from '@/components/admin/storefront/food/AddonGroupsManager';
import { AllergenChart } from '@/components/admin/storefront/food/AllergenChart';
import { MenuQrManager } from '@/components/admin/storefront/food/MenuQrManager';
import { QrModeSettings } from '@/components/admin/storefront/food/QrModeSettings';
import { QR_MODES, type QrMode } from '@/components/admin/storefront/food/qrModes';
import { FloorPlanEditor } from '@/components/admin/floorplan/FloorPlanEditor';
import { PrepStationsManager } from '@/components/admin/horeca/PrepStationsManager';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { useTranslation } from 'react-i18next';
import { ModuleGateLoading, ModuleOffCard } from '@/components/admin/ModuleOffCard';
import { useTracks } from '@/hooks/useBusinessModules';
import { KaartManager } from '@/components/admin/horeca/kaart/KaartManager';

// KAART-4 — de Kaart staat vooraan en is de standaardtab: dat is wat een barman hier het vaakst
// komt doen. Het overzicht (webshop- en QR-status) blijft bereikbaar via ?tab=overview.
const DEFAULT_TAB = 'kaart';
const TABS = [
  // KAART-1 — de kaart: producten snel aanmaken en bewerken (zelfde producten als overal).
  { id: 'kaart', labelKey: 'admin.orderingHub.tab_menu' },
  { id: 'overview', labelKey: 'admin.orderingHub.tab_overview' },
  { id: 'webshop', labelKey: 'admin.orderingHub.tab_webshop' },
  { id: 'qr', labelKey: 'admin.orderingHub.tab_qr' },
  // ZAAL-H1 — tafels, ruimtes en QR-stickers per tafel.
  { id: 'zaal', labelKey: 'admin.orderingHub.tab_floor' },
  // TAFEL-1 — keuken, bar, … en welke categorie waarheen (één bon per post).
  { id: 'posten', labelKey: 'admin.orderingHub.tab_stations' },
  { id: 'extras', labelKey: 'admin.orderingHub.tab_extras' },
  { id: 'allergens', labelKey: 'admin.orderingHub.tab_allergens' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Status({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <Badge variant={on ? 'default' : 'secondary'} className={cn(on && 'bg-emerald-600 hover:bg-emerald-600')}>{children}</Badge>;
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const slug = currentTenant?.slug || '';
  // ZAAL-H1 — zelfde bron als de tab Zaalplan (één bron per getal).
  const { data: floor } = useFloorPlan();
  const { data } = useQuery({
    queryKey: ['ordering-hub', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [ts, fs, methods, groups, menu] = await Promise.all([
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('fulfillment_settings').select('slots_enabled, pay_on_pickup, notify_ready, qr_mode, qr_pay_counter, qr_pay_online, qr_flow').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('shipping_methods').select('fulfillment_type').eq('tenant_id', tenantId!).eq('is_active', true).in('fulfillment_type', ['pickup', 'local_delivery']),
        supabase.from('product_addon_groups').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('is_active', true),
        // Zelfde telling als de tab Kaart (actieve producten, zonder tickets/cadeaubonnen).
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('is_active', true).in('product_type', ['physical', 'service', 'digital'] as never),
      ]);
      const m = methods.data || [];
      return {
        live: !!ts.data?.shop_live, ordering: !!ts.data?.shop_ordering,
        pickup: m.some((x) => x.fulfillment_type === 'pickup'), delivery: m.some((x) => x.fulfillment_type === 'local_delivery'),
        slots: !!fs.data?.slots_enabled, payOnPickup: !!fs.data?.pay_on_pickup, notify: fs.data?.notify_ready !== false,
        qrMode: ((fs.data?.qr_mode as QrMode) || 'view'), qrCounter: fs.data?.qr_pay_counter !== false, qrOnline: !!fs.data?.qr_pay_online,
        // QR-REKENING-1b — op de tafelrekening betaalt de gast op het einde, niet per bestelling.
        qrCheck: fs.data?.qr_flow === 'check',
        groups: groups.count ?? 0,
        menu: menu.count ?? 0,
      };
    },
  });
  if (!data) return null;
  const webshopOn = data.live && data.ordering && (data.pickup || data.delivery);
  const qrMode = QR_MODES.find((m) => m.value === data.qrMode);
  const qrLabel = qrMode ? t(qrMode.titleKey) : '';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn(webshopOn && 'border-emerald-500/50')}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Bike className="h-5 w-5" />{t('admin.orderingHub.webshop_thuis_bestellen')}</CardTitle>
              <Status on={webshopOn}>{webshopOn ? t('admin.orderingHub.aan') : t('admin.adsProductMap.uit')}</Status>
            </div>
            <CardDescription>{t('admin.orderingHub.webshop_desc', { domain: `${slug}.sellqo.shop` })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.winkel_online')}</span><Status on={data.live}>{data.live ? t('admin.orderingHub.yes') : t('admin.orderingHub.no')}</Status></li>
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.online_bestellen')}</span><Status on={data.ordering}>{data.ordering ? t('admin.orderingHub.aan') : t('admin.adsProductMap.uit')}</Status></li>
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.afhalen_leveren')}</span><span>{[data.pickup && t('admin.orderingHub.pickup'), data.delivery && t('admin.orderingHub.delivery')].filter(Boolean).join(' + ') || t('admin.orderingHub.not_set_up')}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.tijdsloten')}</span><span>{data.slots ? t('admin.orderingHub.aan') : t('admin.orderingHub.uit_zo_snel_mogelijk')}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.betalen_bij_afhalen')}</span><span>{data.payOnPickup ? t('admin.orderingHub.aan') : t('admin.adsProductMap.uit')}</span></li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => go('webshop')}>{t('admin.orderingHub.afhalen_leveren_instellen')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              <Button size="sm" variant="outline" asChild><Link to="/admin/storefront"><Globe className="mr-1.5 h-4 w-4" />{t('admin.orderingHub.winkel_openen')}</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(data.qrMode !== 'off' && 'border-emerald-500/50')}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />{t('admin.orderingHub.qr_menu_in_de_zaak')}</CardTitle>
              <Status on={data.qrMode !== 'off'}>{qrLabel}</Status>
            </div>
            <CardDescription>{data.qrMode === 'order' ? t('admin.orderingHub.qr_desc_order') : t('admin.orderingHub.qr_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.stand')}</span><span>{qrLabel}</span></li>
              {data.qrMode === 'order' ? (
                <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.marketing.creditPurchaseDialog.afrekenen')}</span><span>{data.qrCheck ? t('admin.qrFlow.check_short') : [data.qrCounter && t('admin.orderingHub.pay_counter'), data.qrOnline && t('admin.orderingHub.pay_online')].filter(Boolean).join(' / ')}</span></li>
              ) : null}
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.menukaart')}</span>
                <a href={`https://${slug}.sellqo.shop/menu`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{slug}.sellqo.shop/menu<ExternalLink className="h-3 w-3" /></a></li>
              <li className="flex justify-between"><span className="text-muted-foreground">{t('admin.orderingHub.floor_plan')}</span>
                <button type="button" onClick={() => go('zaal')} className="hover:underline">{floor && floor.tables.length > 0 ? t('admin.orderingHub.floor_summary', { tables: floor.tables.length, areas: floor.areas.length }) : t('admin.orderingHub.floor_none')}</button></li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => go('qr')}>{t('admin.orderingHub.qr_menu_instellen_en_afdrukken')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.orderingHub.voor_beide')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={() => go('kaart')} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left hover:bg-muted/50">
            <BookOpen className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">{t('admin.orderingHub.tab_menu')}</span><span className="block text-sm text-muted-foreground">{data.menu ? t('admin.orderingHub.menu_count', { count: data.menu }) : t('admin.orderingHub.menu_empty')}</span></span>
          </button>
          <button type="button" onClick={() => go('extras')} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left hover:bg-muted/50">
            <Pizza className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">{t('admin.storefront.food.addonGroupsManager.extra_s')}</span><span className="block text-sm text-muted-foreground">{data.groups ? t('admin.orderingHub.groups_count', { count: data.groups }) : t('admin.orderingHub.groups_empty')}</span></span>
          </button>
          <Link to="/admin/keuken" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50 hover:no-underline">
            <ChefHat className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">{t('admin.orderingHub.keukenscherm')}</span><span className="block text-sm text-muted-foreground">{t('admin.orderingHub.webshop_tafels_en_kassa_samen')}</span></span>
          </Link>
          <Link to="/admin/pos" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50 hover:no-underline">
            <UtensilsCrossed className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">{t('admin.orderingHub.kassa')}</span><span className="block text-sm text-muted-foreground">{t('admin.orderingHub.ter_plaatse_meenemen_en_telefoon')}</span></span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderingHubPage() {
  const { t } = useTranslation();
  const horeca = useHorecaModule();
  const { ready } = useTracks();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.some((tb) => tb.id === raw) ? (raw as Tab) : DEFAULT_TAB;
  const go = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (t === DEFAULT_TAB) n.delete('tab'); else n.set('tab', t); return n; }, { replace: true });

  if (!ready) return <ModuleGateLoading />;
  if (!horeca) return <ModuleOffCard module="horeca" />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><UtensilsCrossed className="h-8 w-8 text-primary" />{t('admin.orderingHub.bestellen')}</h1>
        <p className="mt-1 text-muted-foreground">{t('admin.orderingHub.twee_manieren_om_bij_jou_te')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.orderingHub.demo_intro')}{' '}
          <a href="https://demo-pizzeria.sellqo.shop" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{t('admin.orderingHub.demo_webshop')}<ExternalLink className="h-3 w-3" /></a>{' · '}
          <a href="https://demo-pizzeria.sellqo.shop/menu?tafel=4" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{t('admin.orderingHub.bestellen_aan_tafel_4')}<ExternalLink className="h-3 w-3" /></a>
        </p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((tb) => (
          <button key={tb.id} type="button" onClick={() => go(tb.id)}
            className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === tb.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>
      <div className="max-w-5xl">
        {tab === 'overview' ? <Overview go={go} /> : null}
        {tab === 'kaart' ? <KaartManager /> : null}
        {tab === 'webshop' ? <FulfillmentSettings /> : null}
        {tab === 'qr' ? <div className="space-y-6"><QrModeSettings /><MenuQrManager onOpenFloorPlan={() => go('zaal')} /></div> : null}
        {tab === 'zaal' ? <FloorPlanEditor /> : null}
        {tab === 'posten' ? <PrepStationsManager /> : null}
        {tab === 'extras' ? <AddonGroupsManager /> : null}
        {tab === 'allergens' ? <AllergenChart /> : null}
      </div>
    </div>
  );
}
