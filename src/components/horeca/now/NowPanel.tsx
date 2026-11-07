// HORECA-NU-1/2 — het "Nu"-paneel bovenaan Vandaag: grote schakelaars voor de cafébaas tijdens de dienst.
// Elke tegel toont zijn stand, wijzigt met één tik en bevestigt kort. Enkel wat de zaak gebruikt (horeca-
// module, QR-menu niet uit, meer dan één zone, online bestellen aan) en wat de rol mag (zelfde regels als de
// RLS: geen tegel die na de tik "geen rechten" zegt). Elke tegel schrijft naar dezelfde bron als het scherm
// waar de instelling thuishoort; dit is de snelle ingang, de instellingen blijven daar (één plek per taak).
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX, ChefHat, Globe, History, PauseCircle, QrCode, Soup, Sun } from 'lucide-react';
import { useTableGroups } from '@/hooks/useTableGroups';
import { previousGuestChecks } from '@/lib/horeca/tableGroups';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCan, useScopedRoles } from '@/hooks/useCan';
import { useHorecaModule } from '@/hooks/useHorecaModule';
import { useHorecaHref } from '@/hooks/useHorecaHref';
import { PAYMENT_SETTINGS_URL } from '@/lib/mijnZaak';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BUSINESS_HOURS_URL } from '@/components/admin/settings/hours/HoursModeChoice';
import { orderingBlocker, useShopOpen } from '@/components/admin/storefront/useShopOpen';
import { PAUSE_MINUTES, endOfToday, useKitchenPause } from '@/components/admin/kitchen/useKitchenPause';
import { useKaart } from '@/components/admin/horeca/kaart/useKaart';
import { isSoldOutNow } from '@/components/admin/storefront/food/useSoldOutToday';
import { qrOrderHasNoPayWay } from '@/components/admin/storefront/food/qrModeRules';
import { activeUntil, pauseEffectKey, pauseTileVisible, zoneTiles } from '@/lib/horeca/nowPanel';
import { NowTile } from './NowTile';
import { SoldOutSheet, SpecialSheet } from './NowSheets';
import { useNowAreas, useNowClosedToday, useNowQr, useNowSpecials } from './useNowData';

const QR_SETTINGS_URL = '/admin/bestellen?tab=qr';
const SITE_URL = '/admin/storefront';
// FIXES-0711: "Betalingen instellen" opent de Stripe-koppeling (Instellingen › Betalingen); via useHorecaHref wordt
// dat voor horeca-only Mijn zaak › Betalen › Online. Was /admin/payments (Transacties) voor een gemengde zaak.

const ReasonLink = ({ text, to, label }: { text: string; to: string; label: string }) => (
  <>{text} <Link to={to} className="font-medium text-primary underline">{label}</Link></>
);

export function NowPanel({ nowMs }: { nowMs: number }) {
  const horeca = useHorecaModule();
  if (!horeca) return null;
  return <NowPanelTiles nowMs={nowMs} />;
}

function NowPanelTiles({ nowMs }: { nowMs: number }) {
  const { t, i18n } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const roles = useScopedRoles();
  // Zelfde rollen als de RLS: tenant_theme_settings, fulfillment_settings en business_hours enkel tenant_admin;
  // dining_areas tenant_admin of staff; products volgens useCan('write', 'products').
  const isAdmin = isPlatformAdmin || (roles ?? []).includes('tenant_admin');
  const isFloor = isAdmin || (roles ?? []).includes('staff');
  const canProducts = useCan('write', 'products');
  const canCreate = useCan('write', 'product_prices');

  const shop = useShopOpen();
  const pause = useKitchenPause();
  const qr = useNowQr();
  const closed = useNowClosedToday(nowMs);
  const areas = useNowAreas();
  const specials = useNowSpecials();
  const kaart = useKaart();
  const href = useHorecaHref();
  const paymentsUrl = href(PAYMENT_SETTINGS_URL);
  const [sheet, setSheet] = useState<null | 'soldout' | 'special'>(null);
  // TAFEL-SAMEN-1 — enkel bij QR op de tafelrekening; zelfde bron als Zaal › Live (horeca_table_groups).
  const navigate = useNavigate();
  const groups = useTableGroups(isFloor && qr.data?.mode === 'order' && qr.data?.flow === 'check');
  const prevGuests = previousGuestChecks(groups.data);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reason, setReason] = useState('');

  const time = (iso: string | Date) => new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const fail = (e: unknown) => {
    const m = e instanceof Error ? e.message : '';
    toast.error(m === 'no_permission' ? t('common.saveNoPermission') : m === 'no_pay_way' ? t('admin.storefront.food.qr_pay_required') : m === 'period' ? t('admin.now.closed.period_toast') : t('admin.now.save_failed'));
  };
  const on = t('admin.now.on');
  const off = t('admin.now.off');
  const products = kaart.data?.products ?? [];
  const soldOutCount = products.filter((p) => p.is_active && isSoldOutNow(p.sold_out_until)).length;
  const specialIds = new Set((specials.data ?? []).map((s) => s.id));
  const specialNames = products.filter((p) => specialIds.has(p.id)).map((p) => p.name);

  const tiles: ReactNode[] = [];

  // 1. Online bestellen (afhalen/leveren via de website) — enkel de beheerder (tenant_theme_settings).
  if (isAdmin && shop.data) {
    const d = shop.data;
    const blocker = d.shop_ordering ? null : orderingBlocker(d);
    tiles.push(
      <NowTile key="ordering" testId="now-ordering" icon={Globe} title={t('admin.now.ordering.title')} state={d.shop_ordering ? on : off}
        tone={d.shop_ordering ? 'on' : 'off'} pressed={d.shop_ordering} busy={shop.saving} disabled={!!blocker}
        reason={blocker === 'offline' ? <ReasonLink text={t('admin.now.ordering.offline')} to={SITE_URL} label={t('admin.now.ordering.offline_link')} />
          : blocker === 'no_payments' ? <ReasonLink text={t('admin.now.ordering.no_payments')} to={paymentsUrl} label={t('admin.now.ordering.no_payments_link')} /> : null}
        onClick={async () => {
          const r = await shop.save({ shop_ordering: !d.shop_ordering });
          if (r.ok) toast.success(t(d.shop_ordering ? 'admin.storefront.shopOpenCard.online_bestellen_staat_uit' : 'admin.storefront.shopOpenCard.online_bestellen_staat_aan'));
          else fail(new Error(r.ok === false ? r.reason : 'error'));
        }} />,
    );
  }

  // 2. Bestellen via de QR aan tafel ('order' ↔ 'view'); QR-menu uit = geen tegel.
  if (isAdmin && qr.data && qr.data.mode !== 'off') {
    const d = qr.data;
    const ordering = d.mode === 'order';
    const noWay = !ordering && qrOrderHasNoPayWay({ ...d, mode: 'order' });
    tiles.push(
      <NowTile key="qr" testId="now-qr" icon={QrCode} title={t('admin.now.qr.title')} state={ordering ? on : off}
        sub={ordering ? null : t('admin.now.qr.view_only')} tone={ordering ? 'on' : 'off'} pressed={ordering} busy={qr.set.isPending}
        disabled={!d.shopLive || noWay}
        reason={!d.shopLive ? <ReasonLink text={t('admin.now.qr.offline')} to={SITE_URL} label={t('admin.now.ordering.offline_link')} />
          : noWay ? <ReasonLink text={t('admin.now.qr.no_pay_way')} to={href(QR_SETTINGS_URL)} label={t('admin.now.qr.settings_link')} /> : null}
        onClick={() => qr.set.mutate(ordering ? 'view' : 'order', {
          onSuccess: (m) => toast.success(t(m === 'order' ? 'admin.now.qr.on_toast' : 'admin.now.qr.off_toast')),
          onError: fail,
        })} />,
    );
  }

  // 3. Keuken pauzeren — als er online of aan tafel besteld kan worden, of al gepauzeerd. HORECA-STAAT-1: de
  // tegel zegt wat er echt stilligt (online, keukengerechten aan tafel), zoals storefront-api het afdwingt.
  const pauseEffect = pause.data ? pauseEffectKey({ online: pause.data.webshop, table: pause.data.table, kitchenSplit: pause.data.kitchenSplit }) : 'effect_online';
  if (isAdmin && pause.data) {
    const until = pause.data.until && activeUntil(pause.data.until, nowMs) ? pause.data.until : null;
    if (pauseTileVisible({ onlineOrdering: pause.data.webshop, tableOrdering: pause.data.table, paused: !!until })) {
      tiles.push(until ? (
        <NowTile key="pause" testId="now-pause" icon={PauseCircle} title={t('admin.now.pause.title')} state={t('admin.now.pause.paused')}
          sub={`${t(`admin.now.pause.${pauseEffect}`, { time: time(until) })} · ${t('admin.now.pause.resume_hint')}`} tone="alert" pressed busy={pause.set.isPending}
          onClick={() => pause.set.mutate(null)} />
      ) : (
        <DropdownMenu key="pause">
          <DropdownMenuTrigger asChild>
            <NowTile testId="now-pause" icon={ChefHat} title={t('admin.now.pause.title')} state={t('admin.now.pause.running')} sub={t('admin.now.pause.tap')} tone="off" busy={pause.set.isPending} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t(pause.data.table && !pause.data.kitchenSplit ? 'admin.kitchen.pause_hint_all' : 'admin.kitchen.pause_hint')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PAUSE_MINUTES.map((m) => (
              <DropdownMenuItem key={m} className="h-11" onClick={() => pause.set.mutate(new Date(Date.now() + m * 60_000))}>{t('admin.kitchen.pause_minutes', { count: m })}</DropdownMenuItem>
            ))}
            <DropdownMenuItem className="h-11" onClick={() => pause.set.mutate(endOfToday())}>{t('admin.kitchen.pause_today')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ));
    }
  }

  // 4. Uitverkocht vandaag (vervangt de kaart "Op voor vandaag"): rechten zoals de Kaart (products write).
  if (canProducts && kaart.data) {
    tiles.push(
      <NowTile key="soldout" testId="now-soldout" icon={CalendarX} title={t('admin.now.soldout.title')}
        state={soldOutCount ? t('admin.now.soldout.count', { count: soldOutCount }) : t('admin.now.soldout.none')}
        tone={soldOutCount ? 'alert' : 'neutral'} onClick={() => setSheet('soldout')} />,
    );
  }

  // 5. Vandaag uitzonderlijk dicht — enkel de beheerder (business_hours).
  if (isAdmin && closed.state) {
    const s = closed.state;
    tiles.push(
      <NowTile key="closed" testId="now-closed" icon={CalendarX} title={t('admin.now.closed.title')} state={s.closed ? t('admin.now.closed.closed') : t('admin.now.closed.open')}
        sub={s.closed ? s.reason : null} tone={s.closed ? 'alert' : 'neutral'} pressed={s.closed} busy={closed.set.isPending}
        disabled={s.period}
        reason={s.period ? <ReasonLink text={t('admin.now.closed.period')} to={href(BUSINESS_HOURS_URL)} label={t('settings.businessHours.edit_link')} /> : null}
        onClick={() => {
          if (!s.closed) { setReason(''); setConfirmClose(true); return; }
          closed.set.mutate({ closed: false }, { onSuccess: () => toast.success(t('admin.now.closed.open_toast')), onError: fail });
        }} />,
    );
  }

  // 6. Zones (terras) — één tegel per zone, enkel bij meer dan één zone; rechten zoals het zaalplan.
  if (isFloor && areas.data) {
    for (const a of zoneTiles(areas.data)) {
      tiles.push(
        <NowTile key={`zone-${a.id}`} testId={`now-zone-${a.id}`} icon={Sun} title={a.name}
          state={a.is_open ? t('admin.now.zone.open') : t('admin.now.zone.closed')} tone={a.is_open ? 'on' : 'alert'} pressed={a.is_open}
          busy={areas.set.isPending && areas.set.variables?.id === a.id}
          onClick={() => areas.set.mutate({ id: a.id, open: !a.is_open }, {
            onSuccess: (open) => toast.success(t(open ? 'admin.now.zone.open_toast' : 'admin.now.zone.closed_toast', { name: a.name })),
            onError: fail,
          })} />,
      );
    }
  }

  // 7. Dagschotel — een product van de kaart (products write); vervalt vanzelf om 05:00.
  if (canProducts && kaart.data && specials.data !== null && specials.data !== undefined) {
    tiles.push(
      <NowTile key="special" testId="now-special" icon={Soup} title={t('admin.now.special.title')}
        state={specialNames.length ? specialNames.join(', ') : t('admin.now.special.none_short')}
        sub={specialNames.length > 1 ? t('admin.now.special.count', { count: specialNames.length }) : null}
        tone={specialNames.length ? 'on' : 'neutral'} onClick={() => setSheet('special')} />,
    );
  }

  // 8. TAFEL-SAMEN-1 — open rekeningen van vorige gasten: enkel een link naar Zaal (daar staat de actie).
  if (isFloor && prevGuests > 0) {
    tiles.push(
      <NowTile key="prev-guests" testId="now-prev-guests" icon={History} title={t('admin.now.prevGuests.title')}
        state={t('admin.now.prevGuests.count', { count: prevGuests })} sub={t('admin.now.prevGuests.sub')} tone="alert"
        onClick={() => navigate('/admin/zaal')} />,
    );
  }

  if (!tiles.length) return null;
  // HORECA-STAAT-1 — vandaag dicht: een duidelijke status bovenaan Vandaag, met één knop om weer te openen
  // (een sluitingsperiode beheer je bij de openingsuren).
  const closedNow = isAdmin && closed.state?.closed ? closed.state : null;
  // HORECA-STAAT-1 — keuken gepauzeerd: de volledige gevolgen in één zin (de tegel is daarvoor te smal op gsm).
  const pausedNow = isAdmin && pause.data?.until && activeUntil(pause.data.until, nowMs) ? pause.data.until : null;

  return (
    <section aria-labelledby="now-panel-title" className="flex flex-col gap-3 rounded-2xl border bg-background p-3 shadow-sm md:p-4" data-testid="now-panel">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="now-panel-title" className="text-lg font-extrabold">{t('admin.now.title')}</h2>
        <span className="text-xs text-muted-foreground">{t('admin.now.subtitle')}</span>
      </div>
      {closedNow ? (
        <div role="status" data-testid="now-closed-banner" className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold">{t('admin.now.closed.banner')}{closedNow.reason ? ` · ${closedNow.reason}` : ''}</p>
            <p className="text-sm text-muted-foreground">{t('admin.now.closed.banner_desc')}</p>
          </div>
          {closedNow.period ? (
            <Link to={href(BUSINESS_HOURS_URL)} className="shrink-0 text-sm font-medium text-primary underline">{t('settings.businessHours.edit_link')}</Link>
          ) : (
            <Button variant="outline" className="h-11 shrink-0" disabled={closed.set.isPending}
              onClick={() => closed.set.mutate({ closed: false }, { onSuccess: () => toast.success(t('admin.now.closed.open_toast')), onError: fail })}>
              {t('admin.now.closed.reopen')}
            </Button>
          )}
        </div>
      ) : null}
      {pausedNow && !closedNow ? (
        <div role="status" data-testid="now-pause-banner" className="flex flex-col gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 font-semibold">{t(`admin.now.pause.${pauseEffect}`, { time: time(pausedNow) })}</p>
          <Button variant="outline" className="h-11 shrink-0" disabled={pause.set.isPending} onClick={() => pause.set.mutate(null)}>{t('admin.now.pause.resume')}</Button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tiles}</div>

      <SoldOutSheet open={sheet === 'soldout'} onClose={() => setSheet(null)} products={products} />
      <SpecialSheet open={sheet === 'special'} onClose={() => setSheet(null)} products={products} categories={kaart.data?.categories ?? []}
        specialIds={specialIds} canCreate={canCreate} />

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.now.closed.confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.now.closed.confirm_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="now-closed-reason">{t('admin.now.closed.reason')}</Label>
            <Input id="now-closed-reason" value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} placeholder={t('admin.now.closed.reason_placeholder')} className="h-11" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => closed.set.mutate({ closed: true, reason: reason.trim() || null }, {
              onSuccess: () => toast.success(t('admin.now.closed.closed_toast')),
              onError: fail,
            })}>{t('admin.now.closed.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
