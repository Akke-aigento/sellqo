// TAFEL-3 — Kas: shift openen met begintelling, kas in/uit met reden, shift sluiten met
// eindtelling (verwacht, geteld, verschil). Fiscaal gaat elke handeling eerst langs de FDM.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, Loader2, LockKeyhole, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { ActionCtx } from '../horeca/actions';
import { parseEuroInput } from '../horeca/pay';
import { formatEuro } from '../horeca/format';
import { cashMove, shift, type ShiftResult } from '../cashActions';
import type { FiscalOpOutcome } from '../fiscalOps';

interface OpenShift { id: string; opened_at: string; opening_cash: number }

const REASONS = ['change', 'purchase', 'bank', 'other'] as const;

export function CashScreen({ ctx }: { ctx: ActionCtx }) {
  const { t, i18n } = useTranslation();
  const euro = (c: number) => formatEuro(c, i18n.language);
  const [open, setOpen] = useState<OpenShift | null | undefined>(undefined);
  const [mode, setMode] = useState<null | 'in' | 'out' | 'open' | 'close'>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [closed, setClosed] = useState<ShiftResult | null>(null);

  const load = async () => {
    const { data } = await supabase.from('pos_sessions').select('id, opened_at, opening_cash')
      .eq('terminal_id', ctx.runtime.device.terminalRowId).eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
    setOpen((data as OpenShift | null) ?? null);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cents = parseEuroInput(amount);
  const needsReason = mode === 'in' || mode === 'out';
  const valid = cents !== null && (mode === 'open' || mode === 'close' ? cents >= 0 : cents > 0) && (!needsReason || reason.trim().length > 0);

  const fail = (o: FiscalOpOutcome<unknown>) => (o.ok ? '' : t(`kassa.cash.error.${o.reason}`, { detail: o.detail ?? '' }));

  const submit = async () => {
    if (!mode || cents === null || !valid) return;
    setBusy(true);
    setMessage(null);
    if (mode === 'in' || mode === 'out') {
      const o = await cashMove(ctx, mode, cents, reason);
      setBusy(false);
      if (!o.ok) { setMessage({ ok: false, text: fail(o) }); return; }
      setMessage({ ok: true, text: o.pending ? t('kassa.cash.pending') : t(mode === 'in' ? 'kassa.cash.doneIn' : 'kassa.cash.doneOut', { amount: euro(cents) }) });
    } else {
      const o = await shift(ctx, mode, cents);
      setBusy(false);
      if (!o.ok) { setMessage({ ok: false, text: fail(o) }); return; }
      if (mode === 'close') setClosed(o.data);
      setMessage({ ok: true, text: o.pending ? t('kassa.cash.pending') : t(mode === 'open' ? 'kassa.cash.shiftOpened' : 'kassa.cash.shiftClosed') });
    }
    setMode(null);
    setAmount('');
    setReason('');
    void load();
  };

  const startMode = (m: typeof mode) => { setMode(m); setAmount(''); setReason(''); setMessage(null); setClosed(null); };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-3">
      <section className="rounded-lg border p-3">
        {open === undefined ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : open ? (
          <p className="text-sm">{t('kassa.cash.shiftOpenSince', {
            time: new Date(open.opened_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
            amount: euro(Math.round(Number(open.opening_cash) * 100)),
          })}</p>
        ) : <p className="text-sm text-muted-foreground">{t('kassa.cash.noShift')}</p>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => startMode('in')} className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border-2 font-semibold', mode === 'in' && 'border-primary')}>
          <ArrowDownToLine className="h-5 w-5" /> {t('kassa.cash.in')}
        </button>
        <button type="button" onClick={() => startMode('out')} className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border-2 font-semibold', mode === 'out' && 'border-primary')}>
          <ArrowUpFromLine className="h-5 w-5" /> {t('kassa.cash.out')}
        </button>
        {open ? (
          <button type="button" onClick={() => startMode('close')} className={cn('col-span-2 flex h-14 items-center justify-center gap-2 rounded-lg border-2 font-semibold', mode === 'close' && 'border-primary')}>
            <LockKeyhole className="h-5 w-5" /> {t('kassa.cash.closeShift')}
          </button>
        ) : (
          <button type="button" onClick={() => startMode('open')} className={cn('col-span-2 flex h-14 items-center justify-center gap-2 rounded-lg border-2 font-semibold', mode === 'open' && 'border-primary')}>
            <Unlock className="h-5 w-5" /> {t('kassa.cash.openShift')}
          </button>
        )}
      </div>

      {mode && (
        <form className="space-y-3 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <p className="font-semibold">{t(`kassa.cash.title.${mode}`)}</p>
          {mode === 'open' || mode === 'close' ? <p className="text-sm text-muted-foreground">{t('kassa.cash.countHint')}</p> : null}
          <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" aria-label={t('kassa.cash.amount')}
            className={cn('h-12 w-full rounded-md border bg-background px-3 text-right text-lg tabular-nums', amount && cents === null && 'border-destructive')} />
          {needsReason && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(t(`kassa.cash.reason.${r}`))}
                    className={cn('h-10 rounded-full border px-3 text-sm', reason === t(`kassa.cash.reason.${r}`) && 'border-primary bg-primary text-primary-foreground')}>
                    {t(`kassa.cash.reason.${r}`)}
                  </button>
                ))}
              </div>
              <input value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} placeholder={t('kassa.cash.reasonPlaceholder')} aria-label={t('kassa.cash.reasonPlaceholder')}
                className="h-11 w-full rounded-md border bg-background px-3" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="submit" disabled={!valid || busy} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.cash.confirm')}
            </button>
          </div>
        </form>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={cn('rounded-md p-3 text-sm', message.ok ? 'bg-muted' : 'bg-destructive/10 text-destructive')}>{message.text}</p>
      )}

      {closed && closed.expected_cents != null && (
        <dl className="grid grid-cols-2 gap-y-1 rounded-lg border p-3 text-sm">
          <dt>{t('kassa.cash.opening')}</dt><dd className="text-right tabular-nums">{euro(closed.opening_cents ?? 0)}</dd>
          <dt>{t('kassa.cash.expected')}</dt><dd className="text-right tabular-nums">{euro(closed.expected_cents)}</dd>
          <dt>{t('kassa.cash.counted')}</dt><dd className="text-right tabular-nums">{euro(closed.counted_cents ?? 0)}</dd>
          <dt className="font-semibold">{t('kassa.cash.difference')}</dt>
          <dd className={cn('text-right font-bold tabular-nums', (closed.difference_cents ?? 0) !== 0 && 'text-destructive')}>{euro(closed.difference_cents ?? 0)}</dd>
        </dl>
      )}
    </div>
  );
}
