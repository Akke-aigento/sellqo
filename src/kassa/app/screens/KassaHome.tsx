// PERSONEEL-1/TAFEL-1 — de kassa na de PIN: kopbalk (wie, verbinding, in/uitklokken, wissel),
// daaronder de tafels of de geopende rekening.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, LogOut, Users, Wifi, WifiOff } from 'lucide-react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { cn } from '@/lib/utils';
import { clock, isClockedIn } from '../attendance';
import { useKassaSession } from '../session';
import type { KassaRuntime } from '../runtime';
import { useHoreca } from '../horeca/useHoreca';
import type { ActionCtx } from '../horeca/actions';
import { readPendingPays, retryPendingPays } from '../horeca/payActions';
import { TablesScreen } from './TablesScreen';
import { CheckScreen } from './CheckScreen';

export function KassaHome({ runtime, terminalName, onForgetDevice }: { runtime: KassaRuntime; terminalName: string; onForgetDevice: () => void }) {
  const { t } = useTranslation();
  const { staff, employeeId, lock } = useKassaSession();
  const store = useHoreca(runtime.device.tenantId, runtime.device.deviceUuid);
  // Ondertekende events die nog op het toestel wachten, gaan altijd eerst naar de cloud.
  store.beforeFlush = () => runtime.flushOutbox();
  const { data: plan } = useFloorPlan();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [autoPay, setAutoPay] = useState(false);
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [clockBusy, setClockBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const labels = useMemo(() => new Map((plan?.tables ?? []).map((x) => [x.id, x.label])), [plan]);
  const ctx: ActionCtx | null = useMemo(() => (staff ? {
    store, runtime, staffId: staff.id, staffName: staff.display_name, employeeId, tableLabel: (id: string | null) => (id ? labels.get(id) ?? null : null),
  } : null), [store, runtime, staff, employeeId, labels]);
  // TAFEL-2: betalingen die na de handtekening nog naar de server moeten (verbinding was weg).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!readPendingPays(runtime.device.tenantId).length) return;
      const r = await retryPendingPays({ runtime });
      if (!alive) return;
      if (r.done) { toast.success(t('kassa.pay.pendingDone', { n: r.done })); void store.refresh(); }
      for (const x of r.rejected) toast.error(t('kassa.pay.pendingRejected', { error: x.error }), { duration: 30_000 });
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [runtime, store, t]);

  if (!staff || !ctx) return null;

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
      {runtime.isFiscal && !employeeId && <p role="alert" className="border-b bg-destructive/10 px-3 py-1.5 text-sm text-destructive">{t('kassa.home.noInsz')}</p>}

      {openCheck ? (
        <CheckScreen key={openCheck} ctx={ctx} checkId={openCheck} initialPay={autoPay} onBack={() => { setOpenCheck(null); setAutoPay(false); }}
          onOpen={(id, o) => { setAutoPay(!!o?.pay); setOpenCheck(id); }} />
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
