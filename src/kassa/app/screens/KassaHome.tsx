// PERSONEEL-1 — startscherm na de PIN: wie staat er, in/uitklokken, wisselen van gebruiker.
// De tafels (zaalplan, rekeningen) komen hier in TAFEL-1.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, LogOut, Users } from 'lucide-react';
import { clock, isClockedIn } from '../attendance';
import { useKassaSession } from '../session';
import type { KassaRuntime } from '../runtime';

export function KassaHome({ runtime, terminalName, onForgetDevice }: { runtime: KassaRuntime; terminalName: string; onForgetDevice: () => void }) {
  const { t } = useTranslation();
  const { staff, employeeId, lock } = useKassaSession();
  const [clockedIn, setClockedIn] = useState(() => (staff ? isClockedIn(runtime.device.tenantId, staff.id) : false));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!staff) return null;

  const toggleClock = async () => {
    setBusy(true);
    setMessage(null);
    const dir = clockedIn ? 'out' : 'in';
    const r = await clock(runtime, staff.id, employeeId, dir);
    setBusy(false);
    if (r.ok) { setClockedIn(dir === 'in'); setMessage(t(dir === 'in' ? 'kassa.home.clockedIn' : 'kassa.home.clockedOut')); }
    else setMessage(t(`kassa.home.clockError.${r.reason ?? 'error'}`));
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ backgroundColor: staff.avatar_color ?? '#3b82f6' }} aria-hidden>
          {staff.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{staff.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">{terminalName} · {t(`kassa.fiscalMode.${runtime.fiscal.mode}`)}</p>
        </div>
        <button type="button" onClick={lock} className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold">
          <Users className="h-4 w-4" /> <span className="hidden sm:inline">{t('kassa.home.switchUser')}</span>
          <span className="sr-only sm:hidden">{t('kassa.home.switchUser')}</span>
        </button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <button type="button" onClick={toggleClock} disabled={busy}
          className={`flex h-16 min-w-56 items-center justify-center gap-2 rounded-xl px-6 text-lg font-semibold ${clockedIn ? 'border' : 'bg-primary text-primary-foreground'} disabled:opacity-50`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
          {t(clockedIn ? 'kassa.home.clockOut' : 'kassa.home.clockIn')}
        </button>
        {message && <p role="status" className="text-sm">{message}</p>}
        {runtime.isFiscal && !employeeId && <p role="alert" className="max-w-sm text-sm text-destructive">{t('kassa.home.noInsz')}</p>}
      </main>
      <footer className="flex justify-center border-t p-2">
        <button type="button" onClick={onForgetDevice} className="flex h-10 items-center gap-2 px-3 text-xs text-muted-foreground">
          <LogOut className="h-4 w-4" /> {t('kassa.home.changeTerminal')}
        </button>
      </footer>
    </div>
  );
}
