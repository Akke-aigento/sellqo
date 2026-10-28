// FOOD-2 — keukenscherm voor pizzeria's, kebabzaken en frituren. Webshop-, kassa- en
// telefoonbestellingen in één overzicht, gesorteerd op afhaal-/levertijd. Gemaakt voor
// een tablet aan de muur: grote knoppen, belletje bij een nieuwe bestelling.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, BellRing, Bike, ChevronDown, Maximize2, Phone, Printer, Store, Undo2, UtensilsCrossed } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { printTicket, type TicketLabels } from '@/components/admin/kitchen/printTicket';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { KitchenPauseControl } from '@/components/admin/kitchen/KitchenPauseControl';
import { cardsForStation, minutesLeft, NEXT_STATUS, PREV_STATUS, type KitchenCard, type KitchenStatus } from '@/components/admin/kitchen/kitchenModel';
import { useTranslation } from 'react-i18next';
import { useHideAdminBottomNav } from '@/hooks/useAdminBottomNav';
import { usePrepStations } from '@/hooks/usePrepStations';
import { ding, readFlag } from '@/lib/ding';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAppShell } from '@/hooks/useAppShell';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';

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
const SOUND_KEY = 'sq_kitchen_sound';
const WAKE_KEY = 'sq_kitchen_wake';
const PRINT_KEY = 'sq_kitchen_autoprint';
const STATION_KEY = 'sq_kitchen_station';

const hhmm = (iso: string | number, lang: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
const euro = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

/** i18n-key van de hoofdknop op een bon. */
function actionKey(c: KitchenCard): string {
  if (c.status === 'new') return 'admin.kitchen.action_start';
  if (c.status === 'preparing') return 'admin.kitchen.action_ready';
  return c.service === 'local_delivery' ? 'admin.kitchen.action_handed_over' : c.service === 'eat_in' ? 'admin.kitchen.action_served' : 'admin.kitchen.action_picked_up';
}

/** Herkomst van een bon: "Webshop #1043", "Kassa" of "Telefoon". */
const sourceName = (c: KitchenCard, t: TFunction) =>
  c.source === 'webshop' ? t('admin.kitchen.webshop_label', { label: c.label })
    : t(c.source === 'phone' ? 'admin.kitchen.source_phone' : c.source === 'table' ? 'admin.kitchen.source_table' : 'admin.kitchen.source_pos');
/** Tafel en/of klantnaam. */
const whoName = (c: KitchenCard, t: TFunction) =>
  [c.table ? t('admin.kitchen.table', { table: c.table }) : null, c.customer].filter(Boolean).join(' · ');

function ticketLabels(t: TFunction, lang: string): TicketLabels {
  return {
    lang,
    service: { pickup: t('admin.kitchen.print_pickup'), local_delivery: t('admin.kitchen.print_delivery'), eat_in: t('admin.kitchen.print_eat_in') },
    order: t('admin.kitchen.print_order'), asap: t('admin.kitchen.print_asap'), paid: t('admin.kitchen.print_paid'), toPay: t('admin.kitchen.print_to_pay'),
    source: (c) => sourceName(c, t), who: (c) => whoName(c, t),
    toPayAmount: (amount) => t('admin.kitchen.print_to_pay_amount', { amount }),
    footer: (ordered, printed) => t('admin.kitchen.print_footer', { ordered, printed }),
  };
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

function TicketCard({ card, now, onAdvance, onBack, onPrint, busy, fresh }: {
  card: KitchenCard; now: number; onAdvance: () => void; onBack: () => void; onPrint: () => void; busy: boolean; fresh: boolean;
}) {
  const { t, i18n } = useTranslation();
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
          {card.orderId ? (
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

export default function KitchenPage() {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);
  const { cards: allCards, isLoading, error, setStatus } = useKitchenBoard(now);
  // TAFEL-1 — dit scherm toont één post (bar, keuken, …) of alles; per toestel onthouden.
  const { data: prep } = usePrepStations();
  const [station, setStation] = useState<string | null>(() => { try { return localStorage.getItem(STATION_KEY) || null; } catch { return null; } });
  const stations = useMemo(() => prep?.stations ?? [], [prep]);
  const activeStation = station && stations.some((s) => s.id === station) ? station : null;
  const cards = useMemo(() => cardsForStation(allCards, activeStation, stations.find((s) => s.is_default)?.id ?? null), [allCards, activeStation, stations]);
  const chooseStation = (id: string) => {
    setStation(id || null);
    try { if (id) localStorage.setItem(STATION_KEY, id); else localStorage.removeItem(STATION_KEY); } catch { /* privémodus */ }
  };
  // HORECA-0 — het keukenscherm ligt over de admin heen: de navigatiepil van de
  // admin (ook z-50, later in de DOM) mag er niet over zweven.
  useHideAdminBottomNav(true);
  // MELDING-1: scherm wakker (per toestel, standaard aan), push als het scherm dicht is, eigen beginscherm-app.
  useAppShell('/keuken.webmanifest', 'Keuken', '#111827');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [wake, setWake] = useState(() => readFlag(WAKE_KEY, true));
  const wakeActive = useWakeLock(wake);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } });
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem(PRINT_KEY) === '1'; } catch { return false; } });
  const { currentTenant } = useTenant();
  const storeName = currentTenant?.name || '';
  const [tab, setTab] = useState<KitchenStatus>('new');
  const [showDone, setShowDone] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  // Nieuwe bestelling: belletje en even laten oplichten. De eerste lading telt niet.
  useEffect(() => {
    if (isLoading) return;
    const open = cards.filter((c) => c.status === 'new').map((c) => c.key);
    if (seen.current === null) { seen.current = new Set(cards.map((c) => c.key)); return; }
    const added = open.filter((k) => !seen.current!.has(k));
    cards.forEach((c) => seen.current!.add(c.key));
    if (!added.length) return;
    if (sound) ding();
    // FOOD-4 — nieuwe bon meteen naar de bonprinter (als dat op dit toestel aan staat).
    if (autoPrint) cards.filter((c) => added.includes(c.key)).forEach((c, i) => setTimeout(() => printTicket(c, storeName, ticketLabels(t, i18n.language)), i * 1500));
    setFresh((f) => new Set([...f, ...added]));
    setTimeout(() => setFresh((f) => { const n = new Set(f); added.forEach((k) => n.delete(k)); return n; }), 20_000);
  }, [cards, isLoading, sound, autoPrint, storeName, t, i18n.language]);

  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    try { localStorage.setItem(PRINT_KEY, next ? '1' : '0'); } catch { /* privémodus */ }
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* privémodus */ }
    if (next) ding(); // ook om de browser audio te laten toestaan
  };

  const byStatus = useMemo(() => {
    const m: Record<KitchenStatus, KitchenCard[]> = { new: [], preparing: [], ready: [], done: [], cancelled: [] };
    cards.forEach((c) => m[c.status].push(c));
    m.done.sort((a, b) => new Date(b.statusAt).getTime() - new Date(a.statusAt).getTime());
    return m;
  }, [cards]);
  const nextHour = cards.filter((c) => c.status !== 'done' && c.requestedTime && minutesLeft(c, now) >= 0 && minutesLeft(c, now) <= 60).length;

  const move = (card: KitchenCard, status: KitchenStatus | null) => { if (status) setStatus.mutate({ card, status }); };

  return (
    // HORECA-0 — notch en statusbalk (app) en de home-balk onderaan respecteren.
    // WANDELING: een dekkende achtergrond. Met enkel bg-muted/40 schemerde de zijbalk van het beheer door het keukenscherm.
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)', backgroundImage: 'linear-gradient(hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.4))' }}>
      <header className="flex items-center gap-2 sm:gap-3 border-b bg-background px-3 sm:px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label={t('admin.kitchen.back_to_admin')}><Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h1 className="text-lg sm:text-xl font-bold truncate">{t('admin.kitchen.title')}</h1>
        <span className="text-xl sm:text-2xl font-bold tabular-nums">{hhmm(now, i18n.language)}</span>
        <span className="hidden text-sm text-muted-foreground xl:inline">
          {t('admin.kitchen.summary', { new: byStatus.new.length, preparing: byStatus.preparing.length, ready: byStatus.ready.length, nextHour })}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {stations.length > 0 ? (
            <select value={activeStation ?? ''} onChange={(e) => chooseStation(e.target.value)} aria-label={t('admin.kitchen.station')}
              className="h-9 max-w-[9rem] rounded-md border bg-background px-2 text-sm">
              <option value="">{t('admin.kitchen.all_stations')}</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : null}
          <KitchenPauseControl now={now} />
          <Button variant={autoPrint ? 'secondary' : 'outline'} size="sm" onClick={toggleAutoPrint} title={t('admin.kitchen.auto_print_hint')} aria-label={autoPrint ? t('admin.kitchen.auto_print_aan') : t('admin.kitchen.auto_print_uit')}>
            <Printer className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{autoPrint ? t('admin.kitchen.auto_print_aan') : t('admin.kitchen.auto_print_uit')}</span>
          </Button>
          <Button variant={sound ? 'secondary' : 'outline'} size="sm" onClick={toggleSound} aria-label={sound ? t('admin.kitchen.geluid_aan') : t('admin.kitchen.geluid_uit')}>
            {sound ? <Bell className="h-4 w-4 sm:mr-1.5" /> : <BellOff className="h-4 w-4 sm:mr-1.5" />}<span className="hidden sm:inline">{sound ? t('admin.kitchen.geluid_aan') : t('admin.kitchen.geluid_uit')}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAlertsOpen(true)} aria-label={t('deviceAlerts.title')} title={t('deviceAlerts.title')}>
            <BellRing className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label={t('admin.kitchen.fullscreen')}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {alertsOpen && currentTenant ? (
        <DeviceAlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} tenantId={currentTenant.id} kind="station"
          defaultName={stations.find((x) => x.id === activeStation)?.name ?? t('deviceAlerts.defaultName.station')}
          stationId={activeStation} stationNames={new Map(stations.map((x) => [x.id, x.name]))}
          wakeKey={WAKE_KEY} wakeDefault onWakeChange={setWake} wakeActive={wakeActive} manageHref="/admin/pos" />
      ) : null}
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
                <TicketCard key={c.key} card={c} now={now} busy={setStatus.isPending} fresh={fresh.has(c.key)}
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
    </div>
  );
}
