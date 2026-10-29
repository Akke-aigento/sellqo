// PERSONEEL-1/TAFEL-1/TAFEL-3 — de kassa na de PIN.
// KASSA-UX-1: één thuis (het zaalplan, met de toog als vaste tegel) en alles binnen twee tikken.
// Kopbalk: wie · verbinding · QR-bestellingen · Wissel · ⋯-menu (Kas, Rapporten, klokken,
// meldingen, naar beheer, andere kassa). In een rekening blijft enkel de balk van die rekening
// over: meer plaats voor de kaart, en terug is altijd één tik.
// KASSA-UX-2: bovenaan wissel je met één tik tussen Zaal, Bar en Keuken (per toestel onthouden).
// Op een tablet staat de kolom Binnenkomend (QR-bestellingen + barbonnen) naast het zaalplan.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Banknote, Bell, BellOff, Check as CheckIcon, ChefHat, Clock, ExternalLink, FileBarChart, LayoutGrid, Loader2, LogOut, MoreHorizontal, Languages, Users, Wifi, WifiOff, Wine } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { deviceLanguage, kassaLanguage, setDeviceLanguage } from '../language';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';
import { clock, isClockedIn } from '../attendance';
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
import { lastService } from '../horeca/counter';
import { useAutoAccept } from '../horeca/requests';
import { RequestInboxButton } from './RequestInbox';
import { BarPanel, KitchenView } from './StationViews';
import { useKitchenBoard } from '@/components/admin/kitchen/useKitchenBoard';
import { useFreshCards, useStationChoice } from '@/components/admin/kitchen/kitchenBoardUtils';
import { cardsForStation, type KitchenCard, type KitchenStatus } from '@/components/admin/kitchen/kitchenModel';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import { useAutoAcceptRunner } from '../horeca/autoAccept';
import { ADMIN_LINK_ROLES, adminHref } from '../horeca/quickTap';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';
import type { HorecaStore } from '../horeca/store';
import { KASSA_SOUND_KEY, KASSA_WAKE_KEY, type KassaAlerts } from '../alerts';

type View = 'tables' | 'cash' | 'reports';
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
  const { staff, employeeId, lock, setIdlePaused, guard } = useKassaSession();
  const { data: plan } = useFloorPlan();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [view, setView] = useState<View>('tables');
  // Een toogverkoop: na afrekenen meteen de volgende klant, terug = naar de tafels.
  const [counterMode, setCounterMode] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [clockBusy, setClockBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // QR-REKENING-1: bestellingen via de QR aan tafel (KASSA-UX-2: in de kolom Binnenkomend).
  const autoAccept = useAutoAccept(runtime.device.tenantId);
  // MELDING-1: geluid en melding op het open scherm, scherm wakker, push als het scherm dicht is.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
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
  const { cards: allCards, isLoading: boardLoading, error: boardError, setStatus } = useKitchenBoard(now);
  const kitchen = useStationChoice(allCards, (st) => st.find((x) => x.kind === 'kitchen')?.id ?? null);
  const barStation = kitchen.stations.find((x) => x.kind === 'bar') ?? null;
  const barCards = useMemo(() => (barStation ? cardsForStation(allCards, barStation.id, kitchen.defaultStation) : []), [allCards, barStation, kitchen.defaultStation]);
  const showBar = mode === 'bar' || (mode === 'zaal' && wide);
  const barFresh = useFreshCards(barCards, boardLoading, { sound: sound && showBar });
  const kitchenFresh = useFreshCards(kitchen.cards, boardLoading, { sound: sound && mode === 'keuken' });
  const onMove = useCallback((card: KitchenCard, status: KitchenStatus) => setStatus.mutate({ card, status }), [setStatus]);
  const board = (fresh: Set<string>) => ({ now, busy: setStatus.isPending, fresh, storeName: currentTenant?.name ?? '', onMove });
  const barCount = store.requests.length + barCards.filter((c) => c.status === 'new').length;
  const kitchenCount = kitchen.cards.filter((c) => c.status === 'new').length;

  const labels = useMemo(() => new Map((plan?.tables ?? []).map((x) => [x.id, x.label])), [plan]);
  const ctx: ActionCtx | null = useMemo(() => (staff ? {
    store, runtime, staffId: staff.id, staffName: staff.display_name, staffRole: staff.role, employeeId, tableLabel: (id: string | null) => (id ? labels.get(id) ?? null : null),
  } : null), [store, runtime, staff, employeeId, labels]);
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
    if (r.ok) { setClockedIn(dir === 'in'); setMessage(t(dir === 'in' ? 'kassa.home.clockedIn' : 'kassa.home.clockedOut')); }
    else setMessage(t(`kassa.home.clockError.${r.reason ?? 'error'}`));
  };

  const canAdmin = ADMIN_LINK_ROLES.has(staff.role);
  const toAdmin = () => {
    const { href, external } = adminHref(window.location.pathname, PUBLIC_SITE_URL);
    if (external) window.open(href, '_blank', 'noopener'); else window.location.assign(href);
  };

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
            {!showBar && <RequestInboxButton count={store.requests.length} onClick={() => setMode('bar')} />}
            <button type="button" onClick={lock} className="flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold">
              <Users className="h-4 w-4" aria-hidden /> {t('kassa.home.switchUser')}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t('kassa.home.menu')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border"><MoreHorizontal className="h-5 w-5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem className="h-11" onClick={() => setView('cash')}><Banknote className="mr-2 h-4 w-4" />{t('kassa.home.tab.cash')}</DropdownMenuItem>
                <DropdownMenuItem className="h-11" onClick={() => setView('reports')}><FileBarChart className="mr-2 h-4 w-4" />{t('kassa.home.tab.reports')}</DropdownMenuItem>
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
                  <DropdownMenuItem className="h-11" onClick={toAdmin}><ExternalLink className="mr-2 h-4 w-4" />{t('kassa.home.toAdmin')}</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="h-11 text-muted-foreground" onClick={() => setConfirmForget(true)}><LogOut className="mr-2 h-4 w-4" />{t('kassa.home.changeTerminal')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {message && <p role="status" className="border-b bg-muted px-3 py-1.5 text-sm">{message}</p>}
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
          {view === 'cash' || view === 'reports' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              {view === 'cash' ? <CashScreen ctx={ctx} /> : <ReportsScreen ctx={ctx} staffRole={staff.role} />}
            </div>
          ) : mode === 'keuken' ? (
            <div className="flex min-h-0 flex-1 flex-col bg-muted/40" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              <KitchenView cards={kitchen.cards} stations={kitchen.stations} activeStation={kitchen.activeStation} onStation={kitchen.choose}
                isLoading={boardLoading} error={boardError} board={board(kitchenFresh)} />
            </div>
          ) : mode === 'bar' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              <BarPanel ctx={ctx} requests={store.requests} cards={barCards} barName={barStation?.name ?? null} wide board={board(barFresh)} beforeAction={guard} />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1" style={{ paddingBottom: 'var(--safe-bottom)' }}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <TablesScreen store={store} staffId={staff.id} tableLabel={ctx.tableLabel} onCounter={newCounterSale} onOpen={(id) => { setAutoPay(false); setCounterMode(false); setOpenCheck(id); }}
                  onTableAction={(tableId, checkId) => setTableAction({ tableId, checkId })} />
              </div>
              {wide && (
                <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l bg-muted/40 xl:w-[420px]" aria-label={t('kassa.bar.incoming')}>
                  <BarPanel ctx={ctx} requests={store.requests} cards={barCards} barName={barStation?.name ?? null} wide={false} board={board(barFresh)} />
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {alertsOpen ? (
        <DeviceAlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} tenantId={runtime.device.tenantId} kind="kassa" defaultName={terminalName}
          soundKey={KASSA_SOUND_KEY} soundDefault onSoundChange={alerts.setSound} wakeKey={KASSA_WAKE_KEY} wakeDefault onWakeChange={alerts.setWake} wakeActive={alerts.wakeActive}
          manageHref={Capacitor.isNativePlatform() ? undefined : '/admin/pos'} />
      ) : null}
      {tableAction && (
        <TableActions ctx={ctx} label={ctx.tableLabel(tableAction.tableId) ?? '?'} check={tableAction.checkId ? store.check(tableAction.checkId) ?? null : null}
          onClose={() => setTableAction(null)}
          onOpen={() => {
            const a = tableAction; setTableAction(null);
            let id = a.checkId;
            if (!id) { id = crypto.randomUUID(); store.enqueue({ id: crypto.randomUUID(), kind: 'open_check', check_id: id, table_id: a.tableId, staff_id: staff.id }); }
            setAutoPay(false); setCounterMode(false); setInitialMove(false); setOpenCheck(id);
          }}
          onMove={() => { const a = tableAction; setTableAction(null); if (a.checkId) { setAutoPay(false); setCounterMode(false); setInitialMove(true); setOpenCheck(a.checkId); } }} />
      )}
      <Dialog open={confirmForget} onOpenChange={setConfirmForget}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('kassa.home.changeTerminal')}</DialogTitle>
            <DialogDescription>{t('kassa.home.changeTerminalConfirm', { name: terminalName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmForget(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={() => { setConfirmForget(false); onForgetDevice(); }} className="h-11 rounded-md bg-destructive px-4 font-semibold text-destructive-foreground">{t('kassa.home.changeTerminalYes')}</button>
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
function TableActions({ ctx, label, check, onClose, onOpen, onMove }: {
  ctx: ActionCtx; label: string; check: Check | null; onClose: () => void; onOpen: () => void; onMove: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState<null | 'bill' | 'free'>(null);
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
            <p className="text-sm">{confirm === 'bill' ? t('kassa.checks.billConfirmText', { amount: formatEuro(checkTotalCents(check!), i18n.language) }) : t('kassa.tableActions.freeConfirm', { title })}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn} onClick={() => setConfirm(null)} disabled={busy}>{t('kassa.common.cancel')}</button>
              <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} disabled={busy}
                onClick={() => void (confirm === 'bill' ? doBill() : doFree())}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : confirm === 'bill' ? t('kassa.checks.billConfirmYes') : t('kassa.tableActions.free')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <button type="button" className={cn(btn, 'border-transparent bg-primary text-primary-foreground')} onClick={onOpen}>{t(check ? 'kassa.tableActions.toCheck' : 'kassa.tableActions.openTable')}</button>
            {canBill && <button type="button" className={btn} onClick={() => setConfirm('bill')}>{t('kassa.tableActions.bill')}</button>}
            {check && !check.paying && (hasSent || visible.length > 0) && <button type="button" className={btn} onClick={onMove}>{t('kassa.checks.moveCheck')}</button>}
            {canFree && <button type="button" className={btn} onClick={() => setConfirm('free')}>{t('kassa.tableActions.free')}</button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
