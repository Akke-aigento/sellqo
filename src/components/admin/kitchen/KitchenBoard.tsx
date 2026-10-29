// FOOD-2 / KASSA-UX-2 — het keukenbord als gedeeld onderdeel: het keukenscherm in het beheer
// (/admin/keuken) en het keukenscherm in SellQo Kassa tonen exact dezelfde bonnen en knoppen.
// De pagina's zelf houden hun eigen kopbalk (terug, geluid, printer, meldingen).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, ChevronDown, Phone, Printer, Store, Undo2, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { printTicket } from './printTicket';
import { minutesLeft, NEXT_STATUS, PREV_STATUS, type KitchenCard, type KitchenStatus } from './kitchenModel';
import { hhmm, sourceName, ticketLabels, whoName } from './kitchenBoardUtils';

const COLUMNS: { status: KitchenStatus; titleKey: string }[] = [
  { status: 'new', titleKey: 'admin.kitchen.col_new' },
  { status: 'preparing', titleKey: 'admin.kitchen.col_preparing' },
  { status: 'ready', titleKey: 'admin.kitchen.col_ready' },
];
const SERVICE = {
  pickup: { labelKey: 'admin.kitchen.svc_pickup', icon: Store, cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' },
  local_delivery: { labelKey: 'admin.kitchen.svc_delivery', icon: Bike, cls: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100' },
  eat_in: { labelKey: 'admin.kitchen.svc_eat_in', icon: UtensilsCrossed, cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' },
} as const;
const euro = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

/** i18n-key van de hoofdknop op een bon. */
function actionKey(c: KitchenCard): string {
  if (c.status === 'new') return 'admin.kitchen.action_start';
  if (c.status === 'preparing') return 'admin.kitchen.action_ready';
  return c.service === 'local_delivery' ? 'admin.kitchen.action_handed_over' : c.service === 'eat_in' ? 'admin.kitchen.action_served' : 'admin.kitchen.action_picked_up';
}

function Countdown({ card, now }: { card: KitchenCard; now: number }) {
  const { t } = useTranslation();
  const m = minutesLeft(card, now);
  if (!card.requestedTime) {
    const waited = -m;
    return <span className={cn('text-sm font-semibold', waited >= 20 ? 'text-red-600' : 'text-muted-foreground')}>{t('admin.kitchen.asap_waited', { count: waited })}</span>;
  }
  if (m < 0) return <span className="text-sm font-bold text-red-600">{t('admin.kitchen.minutes_late', { count: -m })}</span>;
  if (m === 0) return <span className="text-sm font-bold text-orange-600">{t('admin.kitchen.now')}</span>;
  return <span className={cn('text-sm font-semibold', m <= 10 ? 'text-orange-600' : 'text-muted-foreground')}>
    {m >= 90 ? t('admin.kitchen.in_hours', { hours: Math.floor(m / 60), minutes: m % 60 }) : t('admin.kitchen.in_minutes', { count: m })}
  </span>;
}

export function TicketCard({ card, now, onAdvance, onBack, onPrint, busy, fresh, linkOrders = true, compact = false }: {
  card: KitchenCard; now: number; onAdvance: () => void; onBack: () => void; onPrint: () => void; busy: boolean; fresh: boolean;
  /** KASSA-UX-2: in de kassa (geen router) geen link naar de bestelling. */
  linkOrders?: boolean;
  /** KASSA-UX-2: barbon — tafel en wachttijd groot, enkel wat er gemaakt moet worden en de knoppen. */
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (compact) {
    return (
      <article className={cn('flex flex-col gap-2 rounded-xl border-2 bg-card p-3 shadow-sm', fresh ? 'animate-pulse border-primary' : 'border-border')}>
        <header className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-xl font-bold">{whoName(card, t) || sourceName(card, t)}</span>
          <span className={cn('shrink-0 text-sm font-semibold tabular-nums', -minutesLeft(card, now) >= 10 ? 'text-red-600' : 'text-muted-foreground')}>
            {t('admin.kitchen.waited_short', { count: Math.max(0, -minutesLeft(card, now)) })}
          </span>
        </header>
        <ul className="space-y-0.5">
          {card.items.map((it, i) => (
            <li key={i} className={cn('leading-tight', it.quantity < 0 && 'text-destructive line-through')}>
              <span className="font-bold">{Math.abs(it.quantity)}×</span> <span className="font-semibold">{it.name}</span>
              {it.detail || it.addons.length ? <span className="text-sm text-muted-foreground"> · {[it.detail, ...it.addons].filter(Boolean).join(', ')}</span> : null}
            </li>
          ))}
        </ul>
        {card.note ? <p className="rounded-md bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">“{card.note}”</p> : null}
        <footer className="flex items-center gap-2">
          {PREV_STATUS[card.status] ? (
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onBack} disabled={busy} aria-label={t('admin.kitchen.move_back')}><Undo2 className="h-4 w-4" /></Button>
          ) : null}
          {NEXT_STATUS[card.status] ? (
            <Button className={cn('h-11 flex-1 text-base font-bold', card.status === 'preparing' && 'bg-emerald-600 hover:bg-emerald-700')} onClick={onAdvance} disabled={busy}>
              {t(actionKey(card))}
            </Button>
          ) : null}
        </footer>
      </article>
    );
  }
  const svc = card.service ? SERVICE[card.service] : null;
  const late = card.requestedTime ? minutesLeft(card, now) < 0 : false;
  return (
    <article className={cn('flex flex-col gap-3 rounded-xl border-2 bg-card p-4 shadow-sm transition-colors',
      late && card.status !== 'ready' ? 'border-red-500' : 'border-border', fresh && 'animate-pulse border-primary')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-3xl font-bold tabular-nums leading-none">{hhmm(card.requestedTime || card.createdAt, i18n.language)}</div>
          <Countdown card={card} now={now} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {svc ? <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', svc.cls)}><svc.icon className="h-3.5 w-3.5" />{t(svc.labelKey)}</span> : null}
          {card.orderId && linkOrders ? (
            <Link to={`/admin/orders/${card.orderId}`} className="text-xs font-semibold text-muted-foreground hover:underline">{sourceName(card, t)}</Link>
          ) : <span className="text-xs font-semibold text-muted-foreground">{sourceName(card, t)}</span>}
        </div>
      </header>

      {card.customer || card.table || card.phone ? (
        <div className="text-sm">
          {card.customer || card.table ? <span className="font-semibold">{whoName(card, t)}</span> : null}
          {card.phone ? <a href={`tel:${card.phone}`} className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:underline"><Phone className="h-3 w-3" />{card.phone}</a> : null}
          {card.address ? <div className="text-muted-foreground">{card.address}</div> : null}
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {card.items.map((it, i) => (
          <li key={i} className={cn('leading-tight', it.quantity < 0 && 'text-destructive')}>
            {/* TAFEL-1: een annulering uit een tafelronde komt als negatief aantal binnen. */}
            {it.quantity < 0 ? <span className="mr-1 rounded bg-destructive px-1.5 py-0.5 text-xs font-bold uppercase text-destructive-foreground">{t('admin.kitchen.cancelled_item')}</span> : null}
            <span className="text-lg font-bold">{Math.abs(it.quantity)}×</span> <span className={cn('text-lg font-semibold', it.quantity < 0 && 'line-through')}>{it.name}</span>
            {it.detail ? <span className="block pl-7 text-sm text-muted-foreground">{it.detail}</span> : null}
            {it.addons.length ? <span className="block pl-7 text-sm font-semibold text-primary">+ {it.addons.join(', + ')}</span> : null}
          </li>
        ))}
      </ul>

      {card.note ? <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">“{card.note}”</p> : null}

      {/* HORECA-0 — op een smalle kolom mag de actieknop naar een eigen regel. */}
      <footer className="mt-auto flex flex-wrap items-center gap-2">
        {card.notified ? <span className="text-xs font-semibold text-muted-foreground">{t('admin.kitchen.mailed')}</span> : null}
        <span className={cn('mr-auto text-xs font-bold', card.paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
          {card.paid ? t('admin.kitchen.paid') : card.total != null ? t('admin.kitchen.to_pay_amount', { amount: euro(card.total) }) : t('admin.kitchen.to_pay')}
        </span>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onPrint} aria-label={t('admin.kitchen.print_ticket')}><Printer className="h-4 w-4" /></Button>
        {PREV_STATUS[card.status] ? (
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onBack} disabled={busy} aria-label={t('admin.kitchen.move_back')}><Undo2 className="h-4 w-4" /></Button>
        ) : null}
        {NEXT_STATUS[card.status] ? (
          <Button className={cn('h-11 min-w-28 flex-1 sm:flex-none text-base font-bold', card.status === 'preparing' && 'bg-emerald-600 hover:bg-emerald-700')} onClick={onAdvance} disabled={busy}>
            {t(actionKey(card))}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

/** Keuze van de post als keuzelijst (enkel als de zaak posten heeft). */
export function StationSelect({ stations, value, onChange, className }: { stations: { id: string; name: string }[]; value: string | null; onChange: (id: string) => void; className?: string }) {
  const { t } = useTranslation();
  if (!stations.length) return null;
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={t('admin.kitchen.station')}
      className={cn('h-9 max-w-[9rem] rounded-md border bg-background px-2 text-sm', className)}>
      <option value="">{t('admin.kitchen.all_stations')}</option>
      {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

/** De drie kolommen (nieuw, in bereiding, klaar) plus wat al afgewerkt is. Op gsm en tablet staand: tabbladen. */
export function KitchenColumns({ cards, now, isLoading, error, busy, fresh, storeName, onMove, linkOrders = true }: {
  cards: KitchenCard[]; now: number; isLoading: boolean; error: unknown; busy: boolean; fresh: Set<string>; storeName: string;
  onMove: (card: KitchenCard, status: KitchenStatus) => void; linkOrders?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<KitchenStatus>('new');
  const [showDone, setShowDone] = useState(false);
  const byStatus = useMemo(() => {
    const m: Record<KitchenStatus, KitchenCard[]> = { new: [], preparing: [], ready: [], done: [], cancelled: [] };
    cards.forEach((c) => m[c.status].push(c));
    m.done.sort((a, b) => new Date(b.statusAt).getTime() - new Date(a.statusAt).getTime());
    return m;
  }, [cards]);
  const move = (card: KitchenCard, status: KitchenStatus | null) => { if (status) onMove(card, status); };
  return (
    <>
      {/* Gsm en tablet staand: tabbladen per kolom (HORECA-0: drie kolommen pas vanaf 1024 px). */}
      <div className="flex gap-1 border-b bg-background px-2 py-2 lg:hidden">
        {COLUMNS.map((c) => (
          <button key={c.status} type="button" onClick={() => setTab(c.status)}
            className={cn('flex-1 rounded-md px-2 py-2 text-sm font-semibold', tab === c.status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {t(c.titleKey)} ({byStatus[c.status].length})
          </button>
        ))}
      </div>

      {error ? <p className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{t('admin.kitchen.load_error')}</p> : null}

      <main className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 sm:p-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <section key={col.status} className={cn('min-h-0 flex-col gap-3', tab === col.status ? 'flex' : 'hidden lg:flex')}>
            <h2 className="hidden items-center justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground lg:flex">
              {t(col.titleKey)}<span className="rounded-full bg-background px-2 py-0.5">{byStatus[col.status].length}</span>
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-6">
              {isLoading ? <p className="text-sm text-muted-foreground">{t('admin.kitchen.loading')}</p> : null}
              {!isLoading && byStatus[col.status].length === 0 ? (
                <p className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  {col.status === 'new' ? t('admin.kitchen.no_new') : col.status === 'preparing' ? t('admin.kitchen.niets_in_bereiding') : t('admin.kitchen.niets_klaar_om_mee_te_geven')}
                </p>
              ) : null}
              {byStatus[col.status].map((c) => (
                <TicketCard key={c.key} card={c} now={now} busy={busy} fresh={fresh.has(c.key)} linkOrders={linkOrders}
                  onAdvance={() => move(c, NEXT_STATUS[c.status])} onBack={() => move(c, PREV_STATUS[c.status])} onPrint={() => printTicket(c, storeName, ticketLabels(t, i18n.language))} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {byStatus.done.length ? (
        <footer className="max-h-[40vh] overflow-y-auto border-t bg-background px-4 py-2">
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDone && 'rotate-180')} />{t('admin.kitchen.done_count', { count: byStatus.done.length })}
          </button>
          {showDone ? (
            <ul className="mt-2 divide-y text-sm">
              {byStatus.done.map((c) => (
                <li key={c.key} className="flex items-center gap-3 py-1.5">
                  <span className="w-12 font-semibold tabular-nums">{hhmm(c.requestedTime || c.createdAt, i18n.language)}</span>
                  <span className="flex-1 truncate">{sourceName(c, t)} · {whoName(c, t) || '—'} · {c.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                  <Button variant="ghost" size="sm" onClick={() => move(c, 'ready')}><Undo2 className="mr-1 h-3.5 w-3.5" />{t('common.back')}</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </footer>
      ) : null}
    </>
  );
}
