// PERSONEEL-1/TAFEL-1/TAFEL-3 — de kassa na de PIN: kopbalk (wie, verbinding, in/uitklokken,
// wissel), tabbladen Tafels · Toog · Kas · Rapporten, en de geopende rekening of toogverkoop.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Clock, FileBarChart, LayoutGrid, Loader2, LogOut, ShoppingBag, Users, Wifi, WifiOff } from 'lucide-react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { cn } from '@/lib/utils';
import { clock, isClockedIn } from '../attendance';
import { useKassaSession } from '../session';
import type { KassaRuntime } from '../runtime';
import { useHoreca } from '../horeca/useHoreca';
import type { ActionCtx } from '../horeca/actions';
import { TablesScreen } from './TablesScreen';
import { CheckScreen } from './CheckScreen';
import { CashScreen } from './CashScreen';
import { ReportsScreen } from './ReportsScreen';
import { lastService } from '../horeca/counter';
import { useAutoAccept } from '../horeca/requests';
import { RequestInbox, RequestInboxButton } from './RequestInbox';
import { useAutoAcceptRunner } from '../horeca/autoAccept';

type Tab = 'tables' | 'counter' | 'cash' | 'reports';
const TABS: { id: Tab; icon: typeof LayoutGrid }[] = [
  { id: 'tables', icon: LayoutGrid }, { id: 'counter', icon: ShoppingBag }, { id: 'cash', icon: Banknote }, { id: 'reports', icon: FileBarChart },
];

export function KassaHome({ runtime, terminalName, onForgetDevice }: { runtime: KassaRuntime; terminalName: string; onForgetDevice: () => void }) {
  const { t } = useTranslation();
  const { staff, employeeId, lock } = useKassaSession();
  const store = useHoreca(runtime.device.tenantId, runtime.device.deviceUuid);
  const { data: plan } = useFloorPlan();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tables');
  const [autoPay, setAutoPay] = useState(false);
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [clockBusy, setClockBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // QR-REKENING-1: bestellingen via de QR aan tafel.
  const [inboxOpen, setInboxOpen] = useState(false);
  const autoAccept = useAutoAccept(runtime.device.tenantId);

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
    setOpenCheck(id);
  };
  const pickTab = (x: Tab) => {
    setOpenCheck(null);
    setAutoPay(false);
    if (x === 'counter') { setTab('counter'); newCounterSale(); return; }
    setTab(x);
  };

  const toggleClock = async () => {
    setClockBusy(true);
    setMessage(null);
    const dir = clockedIn ? 'out' : 'in';
    const r = await clock(runtime, staff.id, employeeId, dir);
    setClockBusy(false);
    if (r.ok) { setClockedIn(dir === 'in'); setMessage(t(dir === 'in' ? 'kassa.home.clockedIn' : 'kassa.home.clockedOut')); }
    else setMessage(t(`kassa.home.clockError.${r.reason ?? 'error'}`));
  };

  return (
    <div className="flex h-[100dvh] flex-col" style={{ paddingTop: 'var(--safe-top)' }}>
      <header className="flex items-center gap-2 border-b px-2 py-1.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: staff.avatar_color ?? '#3b82f6' }} aria-hidden>
          {staff.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{staff.display_name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {store.online
              ? <><Wifi className="h-3 w-3 text-emerald-600" aria-hidden />{t('kassa.home.live')}</>
              : <><WifiOff className="h-3 w-3 text-destructive" aria-hidden /><span className="text-destructive">{t('kassa.home.offline', { n: store.pendingCount })}</span></>}
            <span aria-hidden>·</span>{terminalName}<span aria-hidden>·</span>{t(`kassa.fiscalMode.${runtime.fiscal.mode}`)}
          </p>
        </div>
        <RequestInboxButton count={store.requests.length} onClick={() => setInboxOpen(true)} />
        <button type="button" onClick={toggleClock} disabled={clockBusy} title={t(clockedIn ? 'kassa.home.clockOut' : 'kassa.home.clockIn')}
          className={cn('flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold disabled:opacity-50', clockedIn ? 'border' : 'bg-primary text-primary-foreground')}>
          {clockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
          <span className="hidden sm:inline">{t(clockedIn ? 'kassa.home.clockOut' : 'kassa.home.clockIn')}</span>
          <span className="sr-only sm:hidden">{t(clockedIn ? 'kassa.home.clockOut' : 'kassa.home.clockIn')}</span>
        </button>
        <button type="button" onClick={lock} className="flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold">
          <Users className="h-4 w-4" /> <span className="hidden sm:inline">{t('kassa.home.switchUser')}</span>
          <span className="sr-only sm:hidden">{t('kassa.home.switchUser')}</span>
        </button>
      </header>
      {message && <p role="status" className="border-b bg-muted px-3 py-1.5 text-sm">{message}</p>}
      {inboxOpen ? <RequestInbox ctx={ctx} requests={store.requests} open={inboxOpen} onClose={() => setInboxOpen(false)} /> : null}
      {runtime.isFiscal && !employeeId && <p role="alert" className="border-b bg-destructive/10 px-3 py-1.5 text-sm text-destructive">{t('kassa.home.noInsz')}</p>}

      <nav className="flex border-b" role="tablist" aria-label={t('kassa.home.tabs')}>
        {TABS.map(({ id, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id && (id === 'counter' || !openCheck)} onClick={() => pickTab(id)}
            className={cn('flex h-12 flex-1 items-center justify-center gap-1.5 text-sm font-semibold', tab === id ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground')}>
            <Icon className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{t(`kassa.home.tab.${id}`)}</span>
            <span className="sr-only sm:hidden">{t(`kassa.home.tab.${id}`)}</span>
          </button>
        ))}
      </nav>

      {openCheck ? (
        <CheckScreen key={openCheck} ctx={ctx} checkId={openCheck} initialPay={autoPay}
          onBack={() => { setOpenCheck(null); setAutoPay(false); if (tab === 'counter') setTab('tables'); }}
          onPaid={(counter) => { setOpenCheck(null); setAutoPay(false); if (counter) newCounterSale(); }}
          onOpen={(id, o) => { setAutoPay(!!o?.pay); setOpenCheck(id); }} />
      ) : tab === 'cash' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><CashScreen ctx={ctx} /></div>
      ) : tab === 'reports' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto"><ReportsScreen ctx={ctx} staffRole={staff.role} /></div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TablesScreen store={store} staffId={staff.id} tableLabel={ctx.tableLabel} onOpen={(id) => { setAutoPay(false); setOpenCheck(id); }} />
          </div>
          <footer className="flex justify-center border-t p-1" style={{ paddingBottom: 'max(0.25rem, var(--safe-bottom))' }}>
            <button type="button" onClick={onForgetDevice} className="flex h-10 items-center gap-2 px-3 text-xs text-muted-foreground">
              <LogOut className="h-4 w-4" /> {t('kassa.home.changeTerminal')}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
