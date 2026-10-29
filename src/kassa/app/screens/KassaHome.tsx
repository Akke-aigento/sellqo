// PERSONEEL-1/TAFEL-1/TAFEL-3 — de kassa na de PIN.
// KASSA-UX-1: één thuis (het zaalplan, met de toog als vaste tegel) en alles binnen twee tikken.
// Kopbalk: wie · verbinding · QR-bestellingen · Wissel · ⋯-menu (Kas, Rapporten, klokken,
// meldingen, naar beheer, andere kassa). In een rekening blijft enkel de balk van die rekening
// over: meer plaats voor de kaart, en terug is altijd één tik.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Banknote, Bell, BellOff, Clock, ExternalLink, FileBarChart, Loader2, LogOut, MoreHorizontal, Users, Wifi, WifiOff } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { PUBLIC_SITE_URL } from '@/lib/siteUrl';
import { clock, isClockedIn } from '../attendance';
import { useKassaSession } from '../session';
import type { KassaRuntime } from '../runtime';
import type { ActionCtx } from '../horeca/actions';
import { TablesScreen } from './TablesScreen';
import { CheckScreen } from './CheckScreen';
import { CashScreen } from './CashScreen';
import { ReportsScreen } from './ReportsScreen';
import { lastService } from '../horeca/counter';
import { useAutoAccept } from '../horeca/requests';
import { RequestInbox, RequestInboxButton } from './RequestInbox';
import { useAutoAcceptRunner } from '../horeca/autoAccept';
import { ADMIN_LINK_ROLES, adminHref } from '../horeca/quickTap';
import { DeviceAlertsDialog } from '@/components/horeca/DeviceAlertsDialog';
import type { HorecaStore } from '../horeca/store';
import { KASSA_SOUND_KEY, KASSA_WAKE_KEY, type KassaAlerts } from '../alerts';

type View = 'tables' | 'cash' | 'reports';

export function KassaHome({ runtime, store, alerts, terminalName, onForgetDevice }: { runtime: KassaRuntime; store: HorecaStore; alerts: KassaAlerts; terminalName: string; onForgetDevice: () => void }) {
  const { t } = useTranslation();
  const { staff, employeeId, lock } = useKassaSession();
  const { data: plan } = useFloorPlan();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [view, setView] = useState<View>('tables');
  // Een toogverkoop: na afrekenen meteen de volgende klant, terug = naar de tafels.
  const [counterMode, setCounterMode] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [clockBusy, setClockBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // QR-REKENING-1: bestellingen via de QR aan tafel.
  const [inboxOpen, setInboxOpen] = useState(false);
  const autoAccept = useAutoAccept(runtime.device.tenantId);
  // MELDING-1: geluid en melding op het open scherm, scherm wakker, push als het scherm dicht is.
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const { sound } = alerts;

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
  const goHome = () => { setOpenCheck(null); setAutoPay(false); setCounterMode(false); setView('tables'); };

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
          <CheckScreen key={openCheck} ctx={ctx} checkId={openCheck} initialPay={autoPay}
            onBack={goHome}
            onPaid={(counter) => { setOpenCheck(null); setAutoPay(false); if (counter && counterMode) newCounterSale(); else goHome(); }}
            onOpen={(id, o) => { setAutoPay(!!o?.pay); setOpenCheck(id); }} />
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
            <RequestInboxButton count={store.requests.length} onClick={() => setInboxOpen(true)} />
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
          {runtime.isFiscal && !employeeId && <p role="alert" className="border-b bg-destructive/10 px-3 py-1.5 text-sm text-destructive">{t('kassa.home.noInsz')}</p>}

          {view !== 'tables' && (
            <div className="flex items-center gap-2 border-b px-2 py-2">
              <button type="button" onClick={goHome} aria-label={t('kassa.home.backToTables')} className="flex h-11 w-11 items-center justify-center rounded-md border"><ArrowLeft className="h-5 w-5" /></button>
              <p className="text-lg font-bold">{t(`kassa.home.tab.${view}`)}</p>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ paddingBottom: 'var(--safe-bottom)' }}>
            {view === 'cash' ? <CashScreen ctx={ctx} />
              : view === 'reports' ? <ReportsScreen ctx={ctx} staffRole={staff.role} />
              : <TablesScreen store={store} staffId={staff.id} tableLabel={ctx.tableLabel} onCounter={newCounterSale} onOpen={(id) => { setAutoPay(false); setCounterMode(false); setOpenCheck(id); }} />}
          </div>
        </>
      )}

      {alertsOpen ? (
        <DeviceAlertsDialog open={alertsOpen} onOpenChange={setAlertsOpen} tenantId={runtime.device.tenantId} kind="kassa" defaultName={terminalName}
          soundKey={KASSA_SOUND_KEY} soundDefault onSoundChange={alerts.setSound} wakeKey={KASSA_WAKE_KEY} wakeDefault onWakeChange={alerts.setWake} wakeActive={alerts.wakeActive}
          manageHref={Capacitor.isNativePlatform() ? undefined : '/admin/pos'} />
      ) : null}
      {inboxOpen ? <RequestInbox ctx={ctx} requests={store.requests} open={inboxOpen} onClose={() => setInboxOpen(false)} /> : null}
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
