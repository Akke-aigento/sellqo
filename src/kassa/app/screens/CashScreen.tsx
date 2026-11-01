// TAFEL-3 — Kas: shift openen met begintelling, kas in/uit met reden, shift sluiten met
// eindtelling (verwacht, geteld, verschil). Fiscaal gaat elke handeling eerst langs de FDM.
// KASSA-UX-6: bij openen/sluiten optioneel tellen per biljet en munt; dat vult het totaal in (het
// blijft één bedrag, net zoals wie meteen het totaal intikt). Fiscaal verandert er niets.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, Calculator, Loader2, LockKeyhole, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { ActionCtx } from '../horeca/actions';
import { parseEuroInput } from '../horeca/pay';
import { formatEuro } from '../horeca/format';
import { DENOMINATIONS, countTotal } from '../horeca/kassaUx';
import { cashMove, shift, type ShiftResult } from '../cashActions';
import { needsApproval } from '../horeca/approvals';
import { ApprovalDialog } from './ApprovalDialog';
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
  // KASSA-UX-6: telling per biljet/munt (null = dicht).
  const [counts, setCounts] = useState<Record<number, string> | null>(null);

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

  // KASSA-RECHTEN-1 (review 1): kas uit door een andere medewerker = eerst het akkoord (vóór het ondertekenen).
  const [askApproval, setAskApproval] = useState(false);
  const submit = async (approvalId?: string) => {
    if (!mode || cents === null || !valid) return;
    if (mode === 'out' && !approvalId && needsApproval(ctx, 'cash_out')) { setAskApproval(true); return; }
    setAskApproval(false);
    setBusy(true);
    setMessage(null);
    if (mode === 'in' || mode === 'out') {
      const o = await cashMove(ctx, mode, cents, reason, approvalId);
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

  const startMode = (m: typeof mode) => { setMode(m); setAmount(''); setReason(''); setMessage(null); setClosed(null); setCounts(null); };
  const countCents = (c: Record<number, string> | null) => countTotal(Object.fromEntries(Object.entries(c ?? {}).map(([k, x]) => [Number(k), x ? Number(x) : 0])));
  const setCount = (d: number, v: string) => {
    const next = { ...(counts ?? {}), [d]: v.replace(/\D/g, '').slice(0, 5) };
    setCounts(next);
    const total = countCents(next);
    setAmount((total / 100).toFixed(2).replace('.', i18n.language.startsWith('en') ? '.' : ','));
  };

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
          {mode === 'out' && needsApproval(ctx, 'cash_out') ? <p className="text-xs text-muted-foreground">{t('kassa.approval.hint')}</p> : null}
          {mode === 'open' || mode === 'close' ? <p className="text-sm text-muted-foreground">{t('kassa.cash.countHint')}</p> : null}
          {(mode === 'open' || mode === 'close') && !counts ? (
            <button type="button" onClick={() => setCounts({})} className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold">
              <Calculator className="h-4 w-4" aria-hidden />{t('kassa.ux6.countByDenomination')}
            </button>
          ) : null}
          {(mode === 'open' || mode === 'close') && counts ? (
            <fieldset className="space-y-2 rounded-md bg-muted/60 p-2">
              <legend className="sr-only">{t('kassa.ux6.countByDenomination')}</legend>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {DENOMINATIONS.map((d) => (
                  <label key={d} className="flex items-center gap-2 rounded-md border bg-background px-2">
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{euro(d)}</span>
                    <span aria-hidden className="text-muted-foreground">×</span>
                    <input inputMode="numeric" value={counts[d] ?? ''} onChange={(e) => setCount(d, e.target.value)} placeholder="0"
                      aria-label={t('kassa.ux6.countOf', { value: euro(d) })} className="h-10 w-full min-w-0 bg-transparent text-right tabular-nums outline-none" />
                  </label>
                ))}
              </div>
              <p className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setCounts(null)} className="h-9 rounded-md border bg-background px-3">{t('kassa.ux6.countClose')}</button>
                <span className="font-semibold tabular-nums">{t('kassa.ux6.countTotal', { amount: euro(countCents(counts)) })}</span>
              </p>
            </fieldset>
          ) : null}
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

      {askApproval && mode === 'out' && cents !== null ? (
        <ApprovalDialog ctx={ctx} action="cash_out" checkId={null} lineId={null} bind={{ amountCents: cents }}
          what={`${euro(cents)} · ${reason.trim()}`} onApproved={(id) => submit(id)} onClose={() => setAskApproval(false)} />
      ) : null}

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
