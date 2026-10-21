// DASH-2b — de horeca-kaarten: keuken nu, drukte, "op voor vandaag" en leveringen.
// De keuken leest uit hetzelfde bord als het keukenscherm (useKitchenBoard), zodat de
// tellingen hier en daar altijd gelijk zijn.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { isToday } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { AlarmClock, ChefHat, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/hooks/useTenant';
import type { CockpitRevenueData } from '@/hooks/useCockpitRevenue';
import type { MenuItemState } from '@/hooks/useCockpitTracks';
import type { KitchenCard } from '@/components/admin/kitchen/kitchenModel';
import { useSoldOutToday } from '@/components/admin/storefront/food/useSoldOutToday';
import { cn, formatCurrency } from '@/lib/utils';
import { HERO_SURFACE, minuteLabel } from './cockpitFormat';

const OPEN = ['new', 'preparing', 'ready'] as const;
type OpenStatus = (typeof OPEN)[number];

const minutesSince = (iso: string, nowMs: number) => Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));

function timerTone(min: number) {
  if (min >= 15) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
  if (min >= 10) return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
}

/** Kort label van een keukenkaart: "Afhaal 18:50", "Levering 19:00", "Tafel 4". */
function useServiceLabel() {
  const { t } = useTranslation();
  return (c: KitchenCard) => {
    const time = c.requestedTime ? minuteLabel(new Date(c.requestedTime).getHours() * 60 + new Date(c.requestedTime).getMinutes()) : null;
    if (c.table) return t('admin.cockpit.kitchen.table', { table: c.table });
    if (c.service === 'local_delivery') return time ? t('admin.cockpit.kitchen.delivery_at', { time }) : t('admin.cockpit.kitchen.delivery');
    if (c.service === 'pickup') return time ? t('admin.cockpit.kitchen.pickup_at', { time }) : t('admin.cockpit.kitchen.pickup');
    if (c.service === 'eat_in') return t('admin.cockpit.kitchen.eat_in');
    return t('admin.cockpit.kitchen.counter');
  };
}

// ------------------------------------------------------------------ keuken nu

interface KitchenProps {
  cards: KitchenCard[];
  isLoading: boolean;
  nowMs: number;
  canOpenKitchen: boolean;
}

export function KitchenHeroCard({ cards, isLoading, nowMs, canOpenKitchen }: KitchenProps) {
  const { t } = useTranslation();
  const label = useServiceLabel();
  const open = cards.filter((c): c is KitchenCard & { status: OpenStatus } => (OPEN as readonly string[]).includes(c.status));
  const oldest = open.reduce<KitchenCard | null>((a, c) => (!a || c.createdAt < a.createdAt ? c : a), null);
  const oldestMin = oldest ? minutesSince(oldest.createdAt, nowMs) : 0;
  const lanes = OPEN.map((status) => ({
    status,
    cards: open.filter((c) => c.status === status).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));

  return (
    <section aria-label={t('admin.cockpit.kitchen.title')} className={cn('flex flex-col gap-5 rounded-2xl p-5 md:p-6', HERO_SURFACE, 'bg-[#13283F] dark:bg-[#0F2033]')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('admin.cockpit.kitchen.title')}</span>
          {isLoading && !cards.length ? (
            <Skeleton className="h-8 w-56 bg-white/20" />
          ) : open.length === 0 ? (
            <span className="text-2xl font-extrabold">{t('admin.cockpit.kitchen.empty')}</span>
          ) : (
            <span className="text-2xl font-extrabold">
              {t('admin.cockpit.kitchen.open', { count: open.length })}
              {oldest && (
                <>
                  {' · '}
                  <span className={oldestMin >= 15 ? 'text-[#FF9B70]' : undefined}>{t('admin.cockpit.kitchen.oldest', { count: oldestMin })}</span>
                </>
              )}
            </span>
          )}
        </div>
        {canOpenKitchen && (
          <Button asChild size="lg" className="h-12 gap-2 rounded-xl bg-[#FF6B33] font-bold text-white hover:bg-[#F25A20]">
            <Link to="/admin/keuken">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
              {t('admin.cockpit.kitchen.open_screen')}
            </Link>
          </Button>
        )}
      </div>

      {/* Mobiel: drie tellers. Breed: drie kolommen met de kaarten. */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {lanes.map((l) => (
          <div key={l.status} className="flex flex-col items-center gap-0.5 rounded-xl bg-white/10 px-2 py-3">
            <span className="text-2xl font-extrabold tabular-nums">{l.cards.length}</span>
            <span className="text-xs text-white/70">{t(`admin.cockpit.kitchen.lane_${l.status}`)}</span>
          </div>
        ))}
      </div>
      {oldest && oldestMin >= 15 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-100 px-3 py-2.5 text-sm font-semibold text-red-900 md:hidden">
          <AlarmClock className="h-4 w-4" aria-hidden="true" />
          {t('admin.cockpit.kitchen.waiting_long', { label: oldest.label, count: oldestMin })}
        </div>
      )}
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        {lanes.map((l) => (
          <div key={l.status} className="flex flex-col gap-2.5 rounded-xl bg-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{t(`admin.cockpit.kitchen.lane_${l.status}`)}</span>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/15 px-1.5 text-xs font-bold tabular-nums">{l.cards.length}</span>
            </div>
            {l.cards.slice(0, 3).map((c) => {
              const min = minutesSince(c.createdAt, nowMs);
              return (
                <div key={c.key} className="flex flex-col gap-1.5 rounded-lg bg-background p-3 text-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold">
                      {c.label} · {label(c)}
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', timerTone(min))}>
                      {t('admin.cockpit.kitchen.minutes', { count: min })}
                    </span>
                  </div>
                  <span className="line-clamp-2 text-sm leading-snug">
                    {c.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </span>
                </div>
              );
            })}
            {l.cards.length > 3 && <span className="text-xs text-white/70">{t('admin.cockpit.kitchen.more', { count: l.cards.length - 3 })}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ tegels

export function HorecaTiles({ data, cards, canRevenue }: { data: CockpitRevenueData | undefined; cards: KitchenCard[]; canRevenue: boolean }) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';

  const { split, throughput } = useMemo(() => {
    const today = cards.filter((c) => isToday(new Date(c.createdAt)));
    const split = {
      pickup: today.filter((c) => c.service === 'pickup').length,
      local_delivery: today.filter((c) => c.service === 'local_delivery').length,
      eat_in: today.filter((c) => c.service === 'eat_in' || !!c.table || (!c.service && c.source === 'pos')).length,
    };
    const done = today.filter((c) => c.status === 'done');
    const throughput = done.length
      ? Math.round(done.reduce((n, c) => n + (new Date(c.statusAt).getTime() - new Date(c.createdAt).getTime()), 0) / done.length / 60_000)
      : null;
    return { split, throughput };
  }, [cards]);

  const total = split.pickup + split.local_delivery + split.eat_in;
  const tile = 'flex flex-col gap-1 rounded-2xl border bg-card p-4';
  const change = data?.hourly.changePct ?? null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {canRevenue && (
        <>
          <div className={tile}>
            <span className="text-xs text-muted-foreground">{t('admin.cockpit.today.revenue')}</span>
            <span className="text-2xl font-extrabold tabular-nums">{data ? formatCurrency(data.todayRevenue, currency) : '–'}</span>
            {change !== null && (
              <span className={cn('text-xs font-semibold', change >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                {t('admin.cockpit.horeca.vs_last_week', { pct: `${change > 0 ? '+' : ''}${change}%` })}
              </span>
            )}
          </div>
          <div className={tile}>
            <span className="text-xs text-muted-foreground">{t('admin.cockpit.horeca.tickets')}</span>
            <span className="text-2xl font-extrabold tabular-nums">{data?.todayOrders ?? '–'}</span>
            {data && data.todayOrders > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('admin.cockpit.horeca.average', { amount: formatCurrency(data.todayRevenue / data.todayOrders, currency) })}
              </span>
            )}
          </div>
        </>
      )}
      <div className={tile}>
        <span className="text-xs text-muted-foreground">{t('admin.cockpit.horeca.throughput')}</span>
        <span className="text-2xl font-extrabold tabular-nums">{throughput === null ? '–' : t('admin.cockpit.kitchen.minutes', { count: throughput })}</span>
        <span className="text-xs text-muted-foreground">{t('admin.cockpit.horeca.throughput_sub')}</span>
      </div>
      <div className={cn(tile, 'gap-2.5')}>
        <span className="text-xs text-muted-foreground">{t('admin.cockpit.horeca.how')}</span>
        {total === 0 ? (
          <span className="text-sm text-muted-foreground">{t('admin.cockpit.horeca.how_empty')}</span>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
              <div className="bg-[#1D3A5C] dark:bg-[#8FB3D9]" style={{ width: `${(split.pickup / total) * 100}%` }} />
              <div className="bg-[#FF6B33]" style={{ width: `${(split.local_delivery / total) * 100}%` }} />
              <div className="bg-[#A9B6C6] dark:bg-[#64748B]" style={{ width: `${(split.eat_in / total) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{split.pickup}</strong> {t('admin.cockpit.horeca.pickup')}</span>
              <span><strong className="text-foreground">{split.local_delivery}</strong> {t('admin.cockpit.horeca.delivery')}</span>
              <span><strong className="text-foreground">{split.eat_in}</strong> {t('admin.cockpit.horeca.eat_in')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ drukte

export function RushCard({ data, isLoading }: { data: CockpitRevenueData | undefined; isLoading: boolean }) {
  const { t } = useTranslation();
  const rush = data?.rush;
  const nowMinute = data ? data.periods.now.getHours() * 60 + data.periods.now.getMinutes() : 0;
  const max = rush ? Math.max(1, ...rush.buckets.map((b) => Math.max(b.today ?? 0, b.expected))) : 1;
  const peak = rush?.peakStartMinute ?? null;
  const untilPeak = peak !== null && peak > nowMinute ? peak - nowMinute : null;
  const ticks = rush ? rush.buckets.filter((b) => b.minute % 60 === 0) : [];

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{t('admin.cockpit.rush.title')}</CardTitle>
          {peak !== null && rush && (
            <p className="text-sm text-muted-foreground">
              {t('admin.cockpit.rush.peak', { from: minuteLabel(peak), to: minuteLabel(peak + 60), count: rush.weeks })}
            </p>
          )}
        </div>
        {untilPeak !== null && untilPeak <= 90 && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">
            {t('admin.cockpit.rush.soon', { count: untilPeak })}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {isLoading && !rush ? (
          <Skeleton className="h-36 w-full" />
        ) : !rush || rush.weeks === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.cockpit.rush.no_history')}</p>
        ) : (
          <>
            <div className="flex h-36 items-end gap-[3px] border-b" role="img" aria-label={t('admin.cockpit.rush.chart_label')}>
              {rush.buckets.map((b) => {
                const isNow = b.today !== null && b.minute + 15 > nowMinute;
                const value = b.today ?? b.expected;
                return (
                  <div key={b.minute} className="flex h-full flex-1 flex-col justify-end">
                    <div
                      className={cn(
                        'min-h-[2px] rounded-t-[4px]',
                        b.today === null
                          ? 'border-2 border-b-0 border-dashed border-muted-foreground/40 bg-muted/40'
                          : isNow
                            ? 'bg-[#FF6B33]'
                            : 'bg-[#1D3A5C] dark:bg-[#8FB3D9]',
                      )}
                      style={{ height: `${(value / max) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Labels op de positie van hun kwartierstaaf, zodat ze ook kloppen als de reeks niet op het uur begint. */}
            <div className="relative h-4 text-xs text-muted-foreground" aria-hidden="true">
              {ticks.map((b) => {
                const i = rush.buckets.indexOf(b);
                return (
                  <span key={b.minute} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / rush.buckets.length) * 100}%` }}>
                    {minuteLabel(b.minute)}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#1D3A5C] dark:bg-[#8FB3D9]" aria-hidden="true" />
                {t('admin.cockpit.rush.legend_today')}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border-2 border-dashed border-muted-foreground/50" aria-hidden="true" />
                {t('admin.cockpit.rush.legend_expected')}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ op voor vandaag

export function SoldOutCard({ items, isLoading, canWrite }: { items: MenuItemState[] | undefined; isLoading: boolean; canWrite: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const soldOut = useSoldOutToday();

  const toggle = (item: MenuItemState) =>
    soldOut.mutate(
      { productId: item.id, soldOut: !item.soldOut },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ['cockpit-menu-state'] }) },
    );

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('admin.cockpit.menu.title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('admin.cockpit.menu.help')}</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading && !items ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.cockpit.menu.empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id} className="flex min-h-12 items-center gap-3">
                <span className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold', item.soldOut && 'text-muted-foreground line-through')}>
                  {item.name}
                </span>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={item.soldOut}
                    disabled={soldOut.isPending}
                    onClick={() => toggle(item)}
                    className={cn('h-11 rounded-full px-4', item.soldOut && 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200')}
                  >
                    {item.soldOut ? t('admin.cockpit.menu.back_on') : t('admin.cockpit.menu.mark_out')}
                  </Button>
                ) : (
                  item.soldOut && <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">{t('admin.cockpit.menu.is_out')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ leveringen

export function DeliveriesCard({ cards, isLoading }: { cards: KitchenCard[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const drops = cards
    .filter((c) => c.service === 'local_delivery' && c.status !== 'done' && c.status !== 'cancelled')
    .sort((a, b) => (a.requestedTime ?? a.createdAt).localeCompare(b.requestedTime ?? b.createdAt));

  return (
    <Card className="flex flex-col rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t('admin.cockpit.deliveries.title')}</CardTitle>
        <span className="text-sm font-bold tabular-nums text-muted-foreground">{drops.length}</span>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading && !cards.length ? (
          <Skeleton className="h-24 w-full" />
        ) : drops.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.cockpit.deliveries.empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {drops.slice(0, 5).map((c) => (
              <li key={c.key}>
                <Link to="/admin/keuken" className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 hover:bg-muted">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-[#1D3A5C] dark:bg-sky-950 dark:text-sky-200" aria-hidden="true">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{c.address ?? c.customer ?? c.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t(`admin.cockpit.deliveries.status_${c.status}`)} · {c.label}
                    </span>
                  </span>
                  {c.requestedTime && (
                    <span className="text-sm font-bold tabular-nums">
                      {minuteLabel(new Date(c.requestedTime).getHours() * 60 + new Date(c.requestedTime).getMinutes())}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
