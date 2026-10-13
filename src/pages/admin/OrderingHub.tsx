// HORECA-1 — "Bestellen": één plek voor de twee manieren waarop klanten bestellen.
//   1. Webshop — thuis bestellen: afhalen of laten leveren (<winkel>.sellqo.shop)
//   2. QR-menu — in de zaak: menukaart bekijken of bestellen aan tafel (/menu?tafel=N)
// Producten, extra's en keuken zijn gedeeld. Alleen met de horeca-module.
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bike, ChefHat, ExternalLink, Globe, Lock, Pizza, QrCode, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FulfillmentSettings } from '@/components/admin/storefront/food/FulfillmentSettings';
import { AddonGroupsManager } from '@/components/admin/storefront/food/AddonGroupsManager';
import { MenuQrManager } from '@/components/admin/storefront/food/MenuQrManager';
import { QrModeSettings } from '@/components/admin/storefront/food/QrModeSettings';
import { QR_MODES, type QrMode } from '@/components/admin/storefront/food/qrModes';

const TABS = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'webshop', label: 'Webshop: afhalen & leveren' },
  { id: 'qr', label: 'QR-menu in de zaak' },
  { id: 'extras', label: "Extra's" },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Status({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <Badge variant={on ? 'default' : 'secondary'} className={cn(on && 'bg-emerald-600 hover:bg-emerald-600')}>{children}</Badge>;
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const slug = currentTenant?.slug || '';
  const { data } = useQuery({
    queryKey: ['ordering-hub', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [ts, fs, methods, groups] = await Promise.all([
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('fulfillment_settings').select('slots_enabled, pay_on_pickup, notify_ready, qr_mode, qr_pay_counter, qr_pay_online').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('shipping_methods').select('fulfillment_type').eq('tenant_id', tenantId!).eq('is_active', true).in('fulfillment_type', ['pickup', 'local_delivery']),
        supabase.from('product_addon_groups').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('is_active', true),
      ]);
      const m = methods.data || [];
      return {
        live: !!ts.data?.shop_live, ordering: !!ts.data?.shop_ordering,
        pickup: m.some((x) => x.fulfillment_type === 'pickup'), delivery: m.some((x) => x.fulfillment_type === 'local_delivery'),
        slots: !!fs.data?.slots_enabled, payOnPickup: !!fs.data?.pay_on_pickup, notify: fs.data?.notify_ready !== false,
        qrMode: ((fs.data?.qr_mode as QrMode) || 'view'), qrCounter: fs.data?.qr_pay_counter !== false, qrOnline: !!fs.data?.qr_pay_online,
        groups: groups.count ?? 0,
      };
    },
  });
  if (!data) return null;
  const webshopOn = data.live && data.ordering && (data.pickup || data.delivery);
  const qrLabel = QR_MODES.find((m) => m.value === data.qrMode)?.title || '';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn(webshopOn && 'border-emerald-500/50')}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Bike className="h-5 w-5" />Webshop: thuis bestellen</CardTitle>
              <Status on={webshopOn}>{webshopOn ? 'Aan' : 'Uit'}</Status>
            </div>
            <CardDescription>Klanten bestellen op {slug}.sellqo.shop en halen af of laten leveren.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">Winkel online</span><Status on={data.live}>{data.live ? 'Ja' : 'Nee'}</Status></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Online bestellen</span><Status on={data.ordering}>{data.ordering ? 'Aan' : 'Uit'}</Status></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Afhalen / leveren</span><span>{[data.pickup && 'Afhalen', data.delivery && 'Leveren'].filter(Boolean).join(' + ') || 'Nog niet ingesteld'}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Tijdsloten</span><span>{data.slots ? 'Aan' : 'Uit (zo snel mogelijk)'}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Betalen bij afhalen</span><span>{data.payOnPickup ? 'Aan' : 'Uit'}</span></li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => go('webshop')}>Afhalen & leveren instellen<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              <Button size="sm" variant="outline" asChild><Link to="/admin/storefront"><Globe className="mr-1.5 h-4 w-4" />Winkel openen</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(data.qrMode !== 'off' && 'border-emerald-500/50')}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />QR-menu: in de zaak</CardTitle>
              <Status on={data.qrMode !== 'off'}>{qrLabel}</Status>
            </div>
            <CardDescription>Klanten scannen de QR-code op tafel of aan de toog en zien je kaart{data.qrMode === 'order' ? ' en bestellen meteen' : ''}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1.5 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">Stand</span><span>{qrLabel}</span></li>
              {data.qrMode === 'order' ? (
                <li className="flex justify-between"><span className="text-muted-foreground">Afrekenen</span><span>{[data.qrCounter && 'Aan de toog', data.qrOnline && 'Online'].filter(Boolean).join(' of ')}</span></li>
              ) : null}
              <li className="flex justify-between"><span className="text-muted-foreground">Menukaart</span>
                <a href={`https://${slug}.sellqo.shop/menu`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{slug}.sellqo.shop/menu<ExternalLink className="h-3 w-3" /></a></li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => go('qr')}>QR-menu instellen en afdrukken<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Voor beide</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => go('extras')} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left hover:bg-muted/50">
            <Pizza className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">Extra's</span><span className="block text-sm text-muted-foreground">{data.groups ? `${data.groups} groep${data.groups === 1 ? '' : 'en'} (toppings, sauzen…)` : 'Toppings, sauzen, bijgerechten'}</span></span>
          </button>
          <Link to="/admin/keuken" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50 hover:no-underline">
            <ChefHat className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">Keukenscherm</span><span className="block text-sm text-muted-foreground">Webshop, tafels en kassa samen</span></span>
          </Link>
          <Link to="/admin/pos" className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/50 hover:no-underline">
            <UtensilsCrossed className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <span><span className="block font-medium">Kassa</span><span className="block text-sm text-muted-foreground">Ter plaatse, meenemen en telefoon</span></span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderingHubPage() {
  const horeca = useHorecaModule();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : 'overview';
  const go = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (t === 'overview') n.delete('tab'); else n.set('tab', t); return n; }, { replace: true });

  if (!horeca) {
    return (
      <div className="p-6">
        <Card className="mx-auto max-w-xl">
          <CardContent className="space-y-3 py-10 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Horeca-module</h1>
            <p className="text-sm text-muted-foreground">Afhalen en leveren, QR-menu, bestellen aan tafel, extra's en het keukenscherm horen bij de horeca-module. Neem contact op met SellQo om hem te activeren.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><UtensilsCrossed className="h-8 w-8 text-primary" />Bestellen</h1>
        <p className="mt-1 text-muted-foreground">Twee manieren om bij jou te bestellen: thuis via de webshop, en in je zaak via het QR-menu. Dezelfde kaart, dezelfde keuken.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Zo ziet het eruit bij een klant:{' '}
          <a href="https://demo-pizzeria.sellqo.shop" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">webshop<ExternalLink className="h-3 w-3" /></a>{' '}en{' '}
          <a href="https://demo-pizzeria.sellqo.shop/menu?tafel=4" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">bestellen aan tafel 4<ExternalLink className="h-3 w-3" /></a>{' '}van onze demopizzeria.
        </p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => go(t.id)}
            className={cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="max-w-5xl">
        {tab === 'overview' ? <Overview go={go} /> : null}
        {tab === 'webshop' ? <FulfillmentSettings /> : null}
        {tab === 'qr' ? <div className="space-y-6"><QrModeSettings /><MenuQrManager /></div> : null}
        {tab === 'extras' ? <AddonGroupsManager /> : null}
      </div>
    </div>
  );
}
