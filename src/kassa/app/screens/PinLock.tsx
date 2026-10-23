// PERSONEEL-1 — PIN-scherm (USR-01): kies je naam, tik je PIN. Grote knoppen, werkt met
// één hand op een gsm en op een vaste tablet aan de bar.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useKassaSession, type KassaStaff } from '../session';

interface Props { tenantId: string; deviceUuid: string }

// Tegenvelden (`reason?: undefined`) houden de union leesbaar zonder strictNullChecks.
type LoginResult =
  | { ok: true; staff: KassaStaff; employee_id: string | null; reason?: undefined; attempts_left?: undefined }
  | { ok: false; reason: 'wrong_pin' | 'locked' | 'inactive'; attempts_left?: number; locked_until?: string; staff?: undefined; employee_id?: undefined };

export function PinLock({ tenantId, deviceUuid }: Props) {
  const { t } = useTranslation();
  const { signIn } = useKassaSession();
  const [staff, setStaff] = useState<KassaStaff[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [picked, setPicked] = useState<KassaStaff | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('pos_cashiers')
        .select('id, display_name, role, employee_no, avatar_color')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('can_use_pos' as never, true as never)
        .order('display_name');
      if (!alive) return;
      if (error) setLoadError(true);
      else setStaff((data ?? []) as unknown as KassaStaff[]);
    })();
    return () => { alive = false; };
  }, [tenantId]);

  const submit = async (value: string) => {
    if (!picked || busy) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('kassa_staff_login' as never, { p_cashier_id: picked.id, p_pin: value, p_device_id: deviceUuid } as never);
    setBusy(false);
    setPin('');
    if (error) { setMessage(t('kassa.pin.error')); return; }
    const r = data as unknown as LoginResult;
    if (r.ok) { signIn(r.staff, r.employee_id); return; }
    if (r.reason === 'locked') setMessage(t('kassa.pin.locked'));
    else if (r.reason === 'inactive') setMessage(t('kassa.pin.inactive'));
    else setMessage(t('kassa.pin.wrong', { n: r.attempts_left ?? 0 }));
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };

  if (loadError) return <p role="alert" className="p-6 text-center">{t('kassa.pin.loadError')}</p>;
  if (!staff) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label={t('kassa.common.loading')} /></div>;
  if (!staff.length) return <p className="p-6 text-center text-muted-foreground">{t('kassa.pin.noStaff')}</p>;

  if (!picked) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <h1 className="mb-4 text-center text-xl font-bold">{t('kassa.pin.whoAreYou')}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {staff.map((s) => (
            <button key={s.id} type="button" onClick={() => { setPicked(s); setMessage(null); }}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-base font-semibold shadow-sm active:scale-[0.98]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: s.avatar_color ?? '#3b82f6' }} aria-hidden>
                {s.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="line-clamp-1">{s.display_name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-4 p-4">
      <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { setPicked(null); setPin(''); setMessage(null); }}>
        {t('kassa.pin.notMe', { name: picked.display_name })}
      </button>
      <div className="flex h-8 items-center gap-3" aria-label={t('kassa.pin.enter')}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-foreground' : 'border border-muted-foreground'}`} />
        ))}
      </div>
      {message && <p role="alert" className="text-center text-sm text-destructive">{message}</p>}
      <div className="grid w-full grid-cols-3 gap-3">
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className="h-16 rounded-xl border bg-card text-2xl font-semibold active:bg-muted">{k}</button>
        ))}
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t('kassa.pin.erase')} className="flex h-16 items-center justify-center rounded-xl border bg-card active:bg-muted">
          <Delete className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => press('0')} className="h-16 rounded-xl border bg-card text-2xl font-semibold active:bg-muted">0</button>
        <button type="button" disabled={pin.length < 4 || busy} onClick={() => submit(pin)}
          className="flex h-16 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('kassa.pin.ok')}
        </button>
      </div>
    </div>
  );
}
