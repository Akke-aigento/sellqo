// PERSONEEL-1/TAFEL-1/TAFEL-3 — de kassa na de PIN.
// KASSA-UX-1: één thuis (het zaalplan, met de toog als vaste tegel) en alles binnen twee tikken.
// Kopbalk: wie · verbinding · QR-bestellingen · Wissel · ⋯-menu (Kas, Rapporten, klokken,
// meldingen, naar beheer, toestel ontkoppelen).
// KASSA-ACCOUNT-1: "Naar beheer" opent altijd een nieuw venster (met waarschuwing: zelfde browser = gedeelde
// aanmelding), "Ontkoppel dit toestel" enkel voor eigenaar/verantwoordelijke, keukenbord via kassa_kitchen_orders. In een rekening blijft enkel de balk van die rekening
// over: meer plaats voor de kaart, en terug is altijd één tik.
// KASSA-UX-2: bovenaan wissel je met één tik tussen Zaal, Bar en Keuken (per toestel onthouden).
// Op een tablet staat de kolom Binnenkomend (QR-bestellingen + barbonnen) naast het zaalplan.
// KASSA-UX-6: in modus Bar een knop Toogverkoop (zonder eerst naar Zaal), en "Mijn dienst" in het ⋯-menu.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Banknote, Bell, BellOff, Check as CheckIcon, ChefHat, Clock, ExternalLink, FileBarChart, HandCoins, LayoutGrid, Loader2, LogOut, MoreHorizontal, Languages, Plus, ShoppingBag, Users, Wifi, WifiOff, Wine, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { deviceLanguage, kassaLanguage, setDeviceLanguage } from '../language';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';
import { clock, fetchClockState, isClockedIn } from '../attendance';
import { useKassaSession } from '../session';
import type { KassaRuntime } from '../runtime';
import { requestBill, type ActionCtx } from '../horeca/actions';
import { checkTotalCents, type Check } from '../horeca/types';
import { formatEuro } from '../horeca/format';
import { toast } from 'sonner';
import { TablesScreen } from './TablesScreen';
import { CheckScreen } from './CheckScreen';
import { CashScreen } from './CashScreen';
import { ReportsScreen } from './ReportsScreen';
import { MyShiftScreen } from './MyShiftScreen';
// HORECA-NU-1: ⋯ › Nu (uitverkocht, keuken pauzeren, terras, dagschotel).
import { NowScreen } from './NowScreen';
import { lastService } from '../horeca/counter';
import { useAutoAccept } from '../horeca/requests';
import { RequestInboxButton } from './RequestInbox';
import { BarPanel, KitchenView } from './StationViews';
import { BOARD_POLL_FAST, useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { useFreshCards, useStationChoice } from '@/components/admin/kitchen/kitchenBoardUtils';
import { cardsForStation, readyCheckIds, type KitchenCard, type KitchenStatus } from '@/components/admin/kitchen/kitchenModel';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import { useAutoAcceptRunner } from '../horeca/autoAccept';
import { useKassaCourseSettings } from '../horeca/paySettings';
import { ADMIN_LINK_ROLES, adminHref } from '../horeca/quickTap';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';
import { PrintHealthBanner } from '@/components/horeca/PrintHealthBanner';
import type { HorecaStore } from '../horeca/store';
import { KASSA_SOUND_KEY, KASSA_WAKE_KEY, type KassaAlerts } from '../alerts';
import { pendingRequests, reservationsByTable, reservationsForDay, timeLabel, type Reservation, type ReservationStatus, type TableReservation } from '@/lib/horeca/reservations';
import { ReservationDialog } from '@/components/horeca/ReservationDialog';
import { ReservationList } from '@/components/horeca/ReservationList';
import { saveReservation, setReservationStatus } from '../horeca/reservationActions';

type View = 'tables' | 'cash' | 'reports' | 'shift' | 'now';
type Mode = 'zaal' | 'bar' | 'keuken';
const MODE_KEY = 'sq_kassa_mode';
const readMode = (): Mode => { try { const v = localStorage.getItem(MODE_KEY); return v === 'bar' || v === 'keuken' ? v : 'zaal'; } catch { return 'zaal'; } };

/** Breed genoeg voor zaalplan + kolom Binnenkomend naast elkaar (tablet liggend, desktop). */
function useWide(min = 1024): boolean {
  const q = `(min-width: ${min}px)`;
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return wide;
}

export function KassaHome({ runtime, store, alerts, terminalName, onForgetDevice }: { runtime: KassaRuntime; store: HorecaStore; alerts: KassaAlerts; terminalName: string; onForgetDevice: () => void }) {
  const { t, i18n } = useTranslation();
  const { staff, employeeId, staffToken, lock, setIdlePaused, guard } = useKassaSession();
  const { data: plan } = useFloorPlan();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [view, setView] = useState<View>('tables');
  // Een toogverkoop: na afrekenen meteen de volgende klant, terug = naar de tafels.
  const [counterMode, setCounterMode] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [clockBusy, setClockBusy] = useState(false);
  // PERSONEEL-2: de knopstand komt van de server (ander toestel kan in- of uitgeklokt hebben).
  useEffect(() => {
    if (!staff) return;
    let live = true;
    setClockedIn(isClockedIn(runtime.device.tenantId, staff.id));
    void fetchClockState(runtime.device.tenantId, staff.id).then((v) => { if (live && v !== null) setClockedIn(v); });
    return () => { live = false; };
  }, [runtime.device.tenantId, staff?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [message, setMessage] = useState<string | null>(null);
  // QR-REKENING-1: bestellingen via de QR aan tafel (KASSA-UX-2: in de kolom Binnenkomend).
  const autoAccept = useAutoAccept(runtime.device.tenantId);
  // MELDING-1: geluid en melding op het open scherm, scherm wakker, push als het scherm dicht is.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const { sound } = alerts;
  const [mode, setModeState] = useState<Mode>(readMode);
  const isDisplay = (m: Mode) => m === 'keuken' || m === 'bar';
  const setMode = (m: Mode) => {
    // KASSA-UX-3: uit Keuken/Bar terug naar Zaal na de wachttijd = eerst je PIN.
    if (isDisplay(mode) && !isDisplay(m) && !guard()) return;
    setModeState(m); setView('tables');
    try { localStorage.setItem(MODE_KEY, m); } catch { /* privémodus */ }
  };
  // Keuken en Bar zijn schermen aan de muur: daar niet vergrendelen bij inactiviteit.
  useEffect(() => { setIdlePaused(mode === 'keuken' || mode === 'bar'); }, [mode, setIdlePaused]);
  const [initialMove, setInitialMove] = useState(false);
  const [tableAction, setTableAction] = useState<{ tableId: string; checkId: string | null } | null>(null);
  // RESERVATIE-1: lijst van vandaag en het reservatievenster (nieuw of wijzigen).
  const [resListOpen, setResListOpen] = useState(false);
  const [resEdit, setResEdit] = useState<{ reservation: Reservation | null; tableId: string | null } | null>(null);
  const wide = useWide();
  const { currentTenant } = useTenant();
  const tenantLanguage = (currentTenant as { language?: string | null } | null)?.language ?? null;
  const [langChoice, setLangChoice] = useState<string | null>(deviceLanguage);
  const pickLanguage = (code: string | null) => {
    setDeviceLanguage(code);
    setLangChoice(code);
    void i18n.changeLanguage(kassaLanguage(tenantLanguage, code));
  };
  const shopLangLabel = SUPPORTED_LANGUAGES.find((l) => l.code === kassaLanguage(tenantLanguage, null))?.label ?? '';

  // Bonnen (keuken en bar) uit het gedeelde keukenbord; één lichte poll per toestel.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);
  // KEUKEN-VEILIG-1: elke 3 s (zoals de rekeningen) zolang er bonnen in beeld staan (Keuken, Bar, of de kolom
  // Binnenkomend naast het zaalplan); enkel het zaalplan op een gsm (tellers) blijft op 10 s. Nooit in de achtergrond.
  const { cards: allCards, isLoading: boardLoading, error: boardError, setStatus, busyKeys } =
    useKitchenBoard(now, true, mode === 'zaal' && !wide ? undefined : BOARD_POLL_FAST, { kassaDevice: true });
  const kitchen = useStationChoice(allCards, (st) => st.find((x) => x.kind === 'kitchen')?.id ?? null);
  const barStation = kitchen.stations.find((x) => x.kind === 'bar') ?? null;
  const barCards = useMemo(() => (barStation ? cardsForStation(allCards, barStation.id, kitchen.defaultStation) : []), [allCards, barStation, kitchen.defaultStation]);
  const showBar = mode === 'bar' || (mode === 'zaal' && wide);
  const barFresh = useFreshCards(barCards, boardLoading, { sound: sound && showBar });
  const kitchenFresh = useFreshCards(kitchen.cards, boardLoading, { sound: sound && mode === 'keuken' });
  const onMove = useCallback((card: KitchenCard, status: KitchenStatus) => setStatus.mutate({ card, status }), [setStatus]);
  // KEUKEN-VEILIG-1: "bezig" per bon (vroeger blokkeerde één tik alle bonnen).
  const board = (fresh: Set<string>) => ({ now, busyKeys, fresh, storeName: currentTenant?.name ?? '', onMove });
  const barCount = store.requests.length + store.calls.length + barCards.filter((c) => c.status === 'new').length;
  const kitchenCount = kitchen.cards.filter((c) => c.status === 'new').length;
  // KEUKEN-VEILIG-1: "klaar" zichtbaar op de tafel in het zaalplan (naast de melding van MELDING-1).
  const readyChecks = useMemo(() => readyCheckIds(allCards), [allCards]);

  const labels = useMemo(() => new Map((plan?.tables ?? []).map((x) => [x.id, x.label])), [plan]);
  const regulars = useMemo(() => new Set((plan?.tables ?? []).filter((x) => x.kind === 'regular').map((x) => x.id)), [plan]);
  const courseSettings = useKassaCourseSettings(runtime.device.tenantId);
  const ctx: ActionCtx | null = useMemo(() => (staff ? {
    store, runtime, staffId: staff.id, staffName: staff.display_name, staffRole: staff.role, staffToken, employeeId, tableLabel: (id: string | null) => (id ? labels.get(id) ?? null : null),
    isRegular: (id: string | null) => !!id && regulars.has(id),
    // GANGEN-1: latere gangen wachten tot ze vrijgegeven worden (instelling van de zaak, standaard uit).
    coursesEnabled: courseSettings.enabled,
  } : null), [store, runtime, staff, staffToken, employeeId, labels, regulars, courseSettings.enabled]);
  useAutoAcceptRunner(ctx, autoAccept, store.requests);
  if (!staff || !ctx) return null;

  // Toog: een nieuwe verkoop openen (geen tafel). Na afrekenen meteen de volgende klant.
  const newCounterSale = () => {
    const id = crypto.randomUUID();
    store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_kind: 'counter', service: lastService(), check_id: id, name: t('kassa.counter.name'), staff_id: staff.id });
    setAutoPay(false);
    setCounterMode(true);
    setOpenCheck(id);
  };
  const goHome = () => { setOpenCheck(null); setAutoPay(false); setInitialMove(false); setCounterMode(false); setView('tables'); };

  const toggleClock = async () => {
    setClockBusy(true);
    setMessage(null);
    const dir = clockedIn ? 'out' : 'in';
    const r = await clock(runtime, staff.id, employeeId, dir);
    setClockBusy(false);
    if (r.ok) {
      const now = r.clockedIn ?? dir === 'in';
      setClockedIn(now);
      setMessage(r.already ? t(now ? 'kassa.home.clockAlreadyIn' : 'kassa.home.clockAlreadyOut')
        : r.notSaved ? t('kassa.home.clockNotSaved') : t(now ? 'kassa.home.clockedIn' : 'kassa.home.clockedOut'));
    }
    else setMessage(t(`kassa.home.clockError.${r.reason ?? 'error'}`));
  };

  const canAdmin = ADMIN_LINK_ROLES.has(staff.role);
  // KASSA-MOBIEL-1: kassa en beheer hebben elk een eigen aanmelding. Op het web en in de SellQo-app (route /kassa)
  // gaat "Naar beheer" dus gewoon naar /admin in hetzelfde venster: het toestel blijft gekoppeld, wie in beheer
  // aangemeld is blijft dat. In de aparte Kassa-app (geen beheer) opent beheer na bevestiging in de browser.
  const admin = adminHref(window.location.pathname, PUBLIC_SITE_URL);
  const openAdmin = () => {
    if (admin.external) { setConfirmAdmin(true); return; }
    window.location.assign(admin.href);
  };
  const toAdmin = () => {
    setConfirmAdmin(false);
    window.open(admin.href, '_blank', 'noopener');
  };

  // RESERVATIE-1 — een laag: nooit een rekening sluiten of wijzigen. Aangekomen op een tafel die nog
  // een open rekening heeft = enkel de status; de nieuwe gasten krijgen niet de rekening van de vorige.
  const resByTable = reservationsByTable(store.reservations, now, store.reservationSettings);
  const markStatus = (r: Reservation, st: ReservationStatus) =>
    setReservationStatus(store, r, st).catch((e: unknown) => toast.error(t('reservations.saveFailed', { detail: e instanceof Error ? e.message : String(e) })));
  const seatReservation = (r: Reservation) => {
    void markStatus(r, 'seated');
    setResListOpen(false);
    setTableAction(null);
    if (!r.table_id) return;
    if (store.checks.some((c) => c.table_id === r.table_id)) { toast.info(t('reservations.tableBusy', { label: ctx.tableLabel(r.table_id) ?? '?' })); return; }
    const id = crypto.randomUUID();
    store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, table_id: r.table_id, guests: r.guests, staff_id: staff.id });
    setAutoPay(false); setCounterMode(false); setInitialMove(false); setOpenCheck(id);
  };
  const tablesForPicker = (plan?.tables ?? []).filter((x) => x.is_active !== false).map((x) => ({ id: x.id, label: x.label }));

  const offlineBar = !store.online
    ? <p role="status" className="flex items-center gap-1.5 border-b bg-destructive/10 px-3 py-1 text-sm text-destructive"><WifiOff className="h-4 w-4" aria-hidden />{t('kassa.home.offline', { n: store.pendingCount })}</p>
    : null;

  return (
    <div className="flex h-[100dvh] flex-col" style={{ paddingTop: 'var(--safe-top)' }}>
      {openCheck ? (
        <>
          {offlineBar}
          <CheckScreen key={openCheck} ctx={ctx} checkId={openCheck} initialPay={autoPay} initialMove={initialMove}
            onBack={goHome}
            onPaid={(counter) => { setOpenCheck(null); setAutoPay(false); if (counter && counterMode) newCounterSale(); else goHome(); }}
            onOpen={(id, o) => { setAutoPay(!!o?.pay); setInitialMove(false); setOpenCheck(id); }} />
        </>
      ) : (
        <>
          <header className="flex items-center gap-2 border-b px-2 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: staff.avatar_color ?? '#3b82f6' }} aria-hidden>
              {staff.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{staff.display_name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {store.online
                  ? <><Wifi className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />{t('kassa.home.live')}</>
                  : <><WifiOff className="h-3 w-3 shrink-0 text-destructive" aria-hidden /><span className="text-destructive">{t('kassa.home.offline', { n: store.pendingCount })}</span></>}
                <span aria-hidden>·</span><span className="truncate">{terminalName}</span>
                <span className="hidden sm:inline" aria-hidden>·</span><span className="hidden truncate sm:inline">{t(`kassa.fiscalMode.${runtime.fiscal.mode}`)}</span>
              </p>
            </div>
            {!showBar && <RequestInboxButton count={store.requests.length + store.calls.length} onClick={() => setMode('bar')} />}
            <button type="button" onClick={lock} className="flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold">
              <Users className="h-4 w-4" aria-hidden /> {t('kassa.home.switchUser')}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t('kassa.home.menu')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border"><MoreHorizontal className="h-5 w-5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem className="h-11" onClick={() => setView('now')}><Zap className="mr-2 h-4 w-4" />{t('kassa.home.tab.now')}</DropdownMenuItem>
                <DropdownMenuItem className="h-11" onClick={() => setView('cash')}><Banknote className="mr-2 h-4 w-4" />{t('kassa.home.tab.cash')}</DropdownMenuItem>
                <DropdownMenuItem className="h-11" onClick={() => setView('reports')}><FileBarChart className="mr-2 h-4 w-4" />{t('kassa.home.tab.reports')}</DropdownMenuItem>
                <DropdownMenuItem className="h-11" onClick={() => setView('shift')}><HandCoins className="mr-2 h-4 w-4" />{t('kassa.home.tab.shift')}</DropdownMenuItem>
                <DropdownMenuItem className="h-11" disabled={clockBusy} onClick={() => void toggleClock()}>
                  {clockBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}{t(clockedIn ? 'kassa.home.clockOut' : 'kassa.home.clockIn')}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-11"><Languages className="mr-2 h-4 w-4" />{t('kassa.home.language')}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    <DropdownMenuItem className="h-11" onClick={() => pickLanguage(null)}>
                      <CheckIcon className={cn('mr-2 h-4 w-4', langChoice && 'invisible')} />{t('kassa.home.languageShop', { lang: shopLangLabel })}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <DropdownMenuItem key={l.code} className="h-11" onClick={() => pickLanguage(l.code)}>
                        <CheckIcon className={cn('mr-2 h-4 w-4', langChoice !== l.code && 'invisible')} />{l.flag} {l.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem className="h-11" onClick={() => setAlertsOpen(true)}>
                  {sound ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}{t('kassa.signals.button')}
                </DropdownMenuItem>
                {canAdmin && (
                  <DropdownMenuItem className="h-11" onClick={openAdmin}><ExternalLink className="mr-2 h-4 w-4" />{t('kassa.home.toAdmin')}</DropdownMenuItem>
                )}
                {canAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="h-11 text-muted-foreground" onClick={() => setConfirmForget(true)}><LogOut className="mr-2 h-4 w-4" />{t('kassa.home.unpair')}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {message && <p role="status" className="border-b bg-muted px-3 py-1.5 text-sm">{message}</p>}
          {/* KEUKEN-VEILIG-1: een bon die niet afdrukt, mag niet stil blijven. */}
          <PrintHealthBanner tenantId={runtime.device.tenantId} />
          {view === 'tables' && (
            <nav className="grid grid-cols-3 gap-1 border-b p-1.5" aria-label={t('kassa.mode.label')}>
              {([['zaal', LayoutGrid, 0], ['bar', Wine, barCount], ['keuken', ChefHat, kitchenCount]] as const).map(([m, Icon, n]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={cn('relative flex h-11 items-center justify-center gap-1.5 rounded-md text-sm font-semibold', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  <Icon className="h-4 w-4" aria-hidden />{t(`kassa.mode.${m}`)}
                  {n > 0 && <span className={cn('rounded-full px-1.5 text-xs font-bold', mode === m ? 'bg-primary-foreground text-primary' : 'bg-amber-500 text-white')}>{n}</span>}
                </button>
              ))}
            </nav>
          )}
          {runtime.isFiscal && !employeeId && <p role="alert" className="border-b bg-destructive/10 px-3 py-1.5 text-sm text-destructive">{t('kassa.home.noInsz')}</p>}

          {view !== 'tables' && (
            <div className="flex items-center gap-2 border-b px-2 py-2">
              <button type="button" onClick={goHome} aria-label={t('kassa.home.backToTables')} className="flex h-11 w-11 items-center justify-center rounded-md border"><ArrowLeft className="h-5 w-5" /></button>
              <p className="text-lg font-bold">{t(`kassa.home.tab.${view}`)}</p>
            </div>
          )}
          {view === 'cash' || view === 'reports' || view === 'shift' || view === 'now' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              {view === 'cash' ? <CashScreen ctx={ctx} /> : view === 'shift' ? <MyShiftScreen ctx={ctx} /> : view === 'now' ? <NowScreen ctx={ctx} /> : <ReportsScreen ctx={ctx} staffRole={staff.role} />}
            </div>
          ) : mode === 'keuken' ? (
            <div className="flex min-h-0 flex-1 flex-col bg-muted/40" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              <KitchenView cards={kitchen.cards} stations={kitchen.stations} activeStation={kitchen.activeStation} onStation={kitchen.choose}
                isLoading={boardLoading} error={boardError} board={board(kitchenFresh)} />
            </div>
          ) : mode === 'bar' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              {/* KASSA-UX-6: de barman verkoopt aan de toog zonder eerst naar Zaal (na de wachttijd eerst de PIN). */}
              <div className="flex justify-end border-b bg-background px-2 py-1.5">
                <button type="button" onClick={() => { if (guard()) newCounterSale(); }}
                  className="flex h-12 items-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground active:scale-[0.98]">
                  <ShoppingBag className="h-5 w-5" aria-hidden />{t('kassa.tables.counter')}
                </button>
              </div>
              <BarPanel ctx={ctx} requests={store.requests} calls={store.calls} cards={barCards} barName={barStation?.name ?? null} wide board={board(barFresh)} beforeAction={guard} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <TablesScreen store={store} staffId={staff.id} tableLabel={ctx.tableLabel} onCounter={newCounterSale} onOpen={(id) => { setAutoPay(false); setCounterMode(false); setOpenCheck(id); }}
                  onTableAction={(tableId, checkId) => setTableAction({ tableId, checkId })} onReservations={() => setResListOpen(true)} readyChecks={readyChecks} />
              </div>
              {wide && (
                <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l bg-muted/40 xl:w-[420px]" aria-label={t('kassa.bar.incoming')}>
                  <BarPanel ctx={ctx} requests={store.requests} calls={store.calls} cards={barCards} barName={barStation?.name ?? null} wide={false} board={board(barFresh)} />
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {alertsOpen ? (
        <DeviceAlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} tenantId={runtime.device.tenantId} kind="kassa" defaultName={terminalName}
          soundKey={KASSA_SOUND_KEY} soundDefault onSoundChange={alerts.setSound} wakeKey={KASSA_WAKE_KEY} wakeDefault onWakeChange={alerts.setWake} wakeActive={alerts.wakeActive} />
      ) : null}
      {tableAction && (
        <TableActions ctx={ctx} label={ctx.tableLabel(tableAction.tableId) ?? '?'} check={tableAction.checkId ? store.check(tableAction.checkId) ?? null : null}
          reservation={resByTable.get(tableAction.tableId)}
          onReserve={() => { const a = tableAction; setTableAction(null); setResEdit({ reservation: null, tableId: a.tableId }); }}
          onEditReservation={(r) => { setTableAction(null); setResEdit({ reservation: r, tableId: r.table_id }); }}
          onReservationStatus={(r, st) => { setTableAction(null); void markStatus(r, st); }}
          onClose={() => setTableAction(null)}
          onOpen={() => {
            const a = tableAction; setTableAction(null);
            const r = resByTable.get(a.tableId)?.reservation;
            if (!a.checkId && r) { seatReservation(r); return; }
            let id = a.checkId;
            if (!id) { id = crypto.randomUUID(); store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, table_id: a.tableId, staff_id: staff.id }); }
            setAutoPay(false); setCounterMode(false); setInitialMove(false); setOpenCheck(id);
          }}
          onMove={() => { const a = tableAction; setTableAction(null); if (a.checkId) { setAutoPay(false); setCounterMode(false); setInitialMove(true); setOpenCheck(a.checkId); } }} />
      )}
      {resListOpen && (
        <Dialog open onOpenChange={(o) => !o && setResListOpen(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('reservations.today')}</DialogTitle>
              <DialogDescription>{t('reservations.todayHint', { minutes: store.reservationSettings.lead_minutes })}</DialogDescription>
            </DialogHeader>
            <button type="button" onClick={() => { setResListOpen(false); setResEdit({ reservation: null, tableId: null }); }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-dashed text-sm font-semibold"><Plus className="h-4 w-4" />{t('reservations.new')}</button>
            {/* RESERVATIE-2: online aanvragen (alle dagen) eerst, dan vandaag. */}
            {pendingRequests(store.reservations).length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t('reservations.pendingTitle', { count: pendingRequests(store.reservations).length })}</h3>
                <ReservationList list={pendingRequests(store.reservations)} settings={store.reservationSettings} tableLabel={ctx.tableLabel} now={now} showDate
                  emptyText="" onSeat={seatReservation}
                  onEdit={(r) => { setResListOpen(false); setResEdit({ reservation: r, tableId: r.table_id }); }}
                  onStatus={(r, st) => void markStatus(r, st)} />
                <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('reservations.today')}</h3>
              </section>
            )}
            <ReservationList list={reservationsForDay(store.reservations, new Date(now)).filter((r) => r.status !== 'requested')} settings={store.reservationSettings} tableLabel={ctx.tableLabel} now={now}
              emptyText={t('reservations.emptyToday')} onSeat={seatReservation}
              onEdit={(r) => { setResListOpen(false); setResEdit({ reservation: r, tableId: r.table_id }); }}
              onStatus={(r, st) => void markStatus(r, st)} />
          </DialogContent>
        </Dialog>
      )}
      {resEdit && (
        <ReservationDialog initial={resEdit.reservation} tables={tablesForPicker} defaultTableId={resEdit.tableId}
          onClose={() => setResEdit(null)}
          onSave={async (input) => { await saveReservation(store, input, resEdit.reservation); toast.success(t('reservations.saved')); }} />
      )}
      <Dialog open={confirmForget} onOpenChange={setConfirmForget}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('kassa.home.unpair')}</DialogTitle>
            <DialogDescription>{t('kassa.home.unpairConfirm', { name: terminalName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmForget(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={() => { setConfirmForget(false); onForgetDevice(); }} className="h-11 rounded-md bg-destructive px-4 font-semibold text-destructive-foreground">{t('kassa.home.unpairYes')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmAdmin} onOpenChange={setConfirmAdmin}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('kassa.home.toAdmin')}</DialogTitle>
            <DialogDescription>{t('kassa.home.toAdminWarning')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmAdmin(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={toAdmin} className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground"><ExternalLink className="h-4 w-4" />{t('kassa.home.toAdminOpen')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * KASSA-UX-3 — lang drukken op een tafel: openen, voorlopige rekening (met bevestiging), verplaatsen of
 * samenvoegen, of een lege tafel vrijgeven. Geen slepen: met natte vingers voeg je zo per ongeluk samen.
 */
function TableActions({ ctx, label, check, reservation, onClose, onOpen, onMove, onReserve, onEditReservation, onReservationStatus }: {
  ctx: ActionCtx; label: string; check: Check | null; onClose: () => void; onOpen: () => void; onMove: () => void;
  /** RESERVATIE-1: reservatie die nu op deze tafel staat (paars), of niets. */
  reservation?: TableReservation;
  onReserve: () => void; onEditReservation: (r: Reservation) => void; onReservationStatus: (r: Reservation, s: ReservationStatus) => void;
}) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState<null | 'bill' | 'free' | 'unbill'>(null);
  const [busy, setBusy] = useState(false);
  const visible = check ? check.lines.filter((l) => l.state !== 'void') : [];
  const hasSent = visible.some((l) => l.state === 'sent');
  const canBill = !!check && !check.paying && visible.length > 0;
  const canFree = !!check && !check.paying && visible.length === 0;
  const title = t('kassa.checks.table', { label });
  const doBill = async () => {
    if (!check) return;
    setBusy(true);
    const o = await requestBill(ctx, check.id);
    setBusy(false);
    if (o.ok) { toast.success(t('kassa.checks.billRequested')); onClose(); } else toast.error(t(`kassa.checks.error.${o.reason}`, { detail: o.detail ?? '' }));
  };
  const doFree = async () => {
    if (!check) return;
    setBusy(true);
    const r = await ctx.store.applyNow({ id: crypto.randomUUID(), kind: 'void_check', check_id: check.id, staff_id: ctx.staffId }).catch(() => null);
    setBusy(false);
    if (r?.ok) onClose(); else toast.error(t('kassa.checks.error.server', { detail: r?.error ?? '' }));
  };
  // KASSA-UX-4: rekening per ongeluk gevraagd → status terug naar bezet. Geen fiscaal event: de
  // ondertekende voorlopige rekening blijft bestaan, enkel de tafelstatus verandert.
  const canUnbill = !!check && !check.paying && !!check.bill_requested_at;
  const doUnbill = async () => {
    if (!check) return;
    setBusy(true);
    const r = await ctx.store.applyNow({ id: crypto.randomUUID(), kind: 'cancel_bill', check_id: check.id, staff_id: ctx.staffId }).catch(() => null);
    setBusy(false);
    if (r?.ok) { toast.success(t('kassa.tableActions.unbillDone')); onClose(); } else toast.error(t('kassa.checks.error.server', { detail: r?.error ?? '' }));
  };
  const btn = 'flex h-12 w-full items-center justify-center rounded-md border text-base font-semibold disabled:opacity-40';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{check ? t('kassa.tableActions.open', { amount: formatEuro(checkTotalCents(check), i18n.language) }) : t('kassa.tables.free')}</DialogDescription>
        </DialogHeader>
        {confirm ? (
          <div className="space-y-3">
            <p className="text-sm">{confirm === 'bill' ? t('kassa.checks.billConfirmText', { amount: formatEuro(checkTotalCents(check!), i18n.language) })
              : confirm === 'unbill' ? t('kassa.tableActions.unbillConfirm', { title }) : t('kassa.tableActions.freeConfirm', { title })}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn} onClick={() => setConfirm(null)} disabled={busy}>{t('kassa.common.cancel')}</button>
              <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} disabled={busy}
                onClick={() => void (confirm === 'bill' ? doBill() : confirm === 'unbill' ? doUnbill() : doFree())}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : confirm === 'bill' ? t('kassa.checks.billConfirmYes') : confirm === 'unbill' ? t('kassa.tableActions.unbill') : t('kassa.tableActions.free')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} onClick={onOpen}>{t(check ? 'kassa.tableActions.toCheck' : reservation ? 'reservations.seat' : 'kassa.tableActions.openTable')}</button>
            {canUnbill && <button type="button" className={btn} onClick={() => setConfirm('unbill')}>{t('kassa.tableActions.unbill')}</button>}
            {canBill && <button type="button" className={btn} onClick={() => setConfirm('bill')}>{t('kassa.tableActions.bill')}</button>}
            {check && !check.paying && (hasSent || visible.length > 0) && <button type="button" className={btn} onClick={onMove}>{t('kassa.checks.moveCheck')}</button>}
            {canFree && <button type="button" className={btn} onClick={() => setConfirm('free')}>{t('kassa.tableActions.free')}</button>}
            {reservation ? (
              <div className="space-y-2 rounded-md border border-violet-500 bg-violet-50 p-2 text-violet-950 dark:bg-violet-950 dark:text-violet-50">
                <p className="text-sm font-semibold">
                  {t('reservations.onTable', { time: timeLabel(reservation.reservation.starts_at, i18n.language), name: reservation.reservation.name, guests: reservation.reservation.guests })}
                  {reservation.late ? ` · ${t('reservations.late')}` : ''}
                </p>
                {reservation.reservation.note ? <p className="text-xs italic">“{reservation.reservation.note}”</p> : null}
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className={cn(btn, 'h-11 text-sm')} onClick={() => onEditReservation(reservation.reservation)}>{t('reservations.edit')}</button>
                  <button type="button" className={cn(btn, 'h-11 text-sm')} onClick={() => onReservationStatus(reservation.reservation, 'no_show')}>{t('reservations.noShow')}</button>
                  <button type="button" className={cn(btn, 'h-11 text-sm text-destructive')} onClick={() => onReservationStatus(reservation.reservation, 'cancelled')}>{t('reservations.cancel')}</button>
                </div>
              </div>
            ) : (
              <button type="button" className={btn} onClick={onReserve}>{t('reservations.reserve')}</button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
