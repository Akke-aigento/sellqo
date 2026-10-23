// TAFEL-2 — afrekenen van één rekening.
//
// Snel: "Contant" of "Kaart" voor het hele bedrag. Delen: in n gelijke delen, elk met een
// eigen betaalmiddel (één btw-kasticket, UC4119). Vrij: betaalmiddelen en bedragen zelf.
// Contant toont het afgeronde bedrag (5 cent) en het wisselgeld; fooi staat apart.
// Na afloop: bonnummer, wisselgeld en (geregistreerde kassa) het kasticket om af te drukken.
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, Loader2, Minus, Plus, Printer, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import { buildKasticket, renderHtml } from '../../print';
import type { ActionCtx } from '../horeca/actions';
import { changeDue, equalSplit, planPayment, TENDER_METHODS, type PaymentPlan, type Tender, type TenderMethod, type TipMethod } from '../horeca/pay';
import { payableTotal, payCheck, type PayOutcome } from '../horeca/payActions';
import { lineTotalCents, type Check } from '../horeca/types';
import { formatEuro } from '../horeca/format';

/** "12,50" / "12.5" / "12" → centen; ongeldig = null. */
export function parseEuroInput(s: string): number | null {
  const v = s.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{0,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}
const toInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

interface Row { method: TenderMethod; amount: string }

export function PayDialog({ ctx, check, onClose, onPaid }: { ctx: ActionCtx; check: Check; onClose: () => void; onPaid: () => void }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const euro = (c: number) => formatEuro(c, i18n.language);
  // Wat nog niet verstuurd is, gaat bij afrekenen eerst mee; het totaal telt het dus al mee.
  const total = useMemo(() => payableTotal(check) + check.lines.filter((l) => l.state === 'draft').reduce((s, l) => s + lineTotalCents(l), 0), [check]);
  const [rows, setRows] = useState<Row[]>([{ method: 'card', amount: toInput(total) }]);
  const [tip, setTip] = useState('');
  const [tipMethod, setTipMethod] = useState<TipMethod>('card');
  const [given, setGiven] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<PayOutcome, { ok: true }> | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const tenders: Tender[] | null = useMemo(() => {
    const out: Tender[] = [];
    for (const r of rows) {
      const c = parseEuroInput(r.amount);
      if (c === null) return null;
      if (c > 0) out.push({ method: r.method, amount_cents: c });
    }
    return out;
  }, [rows]);
  const tipCents = tip.trim() ? parseEuroInput(tip) : 0;
  const plan: PaymentPlan | null = useMemo(() => {
    if (!tenders || tipCents === null) return null;
    try { return planPayment(total, tenders, tipCents, tipCents > 0 ? tipMethod : null); } catch { return null; }
  }, [tenders, tipCents, tipMethod, total]);
  const entered = (tenders ?? []).reduce((s, x) => s + x.amount_cents, 0);
  const rest = total - entered;
  const givenCents = given.trim() ? parseEuroInput(given) : null;

  const setAll = (method: TenderMethod) => { setRows([{ method, amount: toInput(total) }]); setError(null); };
  const split = (n: number) => { setRows(equalSplit(total, n).map((c, i) => ({ method: rows[i]?.method ?? 'card', amount: toInput(c) }))); setError(null); };
  const patch = (i: number, r: Partial<Row>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...r } : x)));

  const confirm = async () => {
    if (!plan || !tenders) return;
    setBusy(true);
    setError(null);
    const o = await payCheck(ctx, check.id, tenders, plan.tip, plan.tipMethod);
    setBusy(false);
    if (!o.ok) {
      setError(o.reason === 'plan' ? t('kassa.pay.error.plan') : t(`kassa.pay.error.${o.reason}`, { detail: o.detail ?? '' }));
      return;
    }
    setDone(o);
  };

  // Kasticket (enkel geregistreerde kassa): uit het FDM-antwoord, nooit zelf samengesteld.
  const ticketHtml = useMemo(() => {
    if (!done?.signed || !ctx.runtime.fiscal.vatNo || !ctx.runtime.fiscal.estNo) return null;
    try {
      const doc = buildKasticket(done.signed, {
        business: {
          legalName: currentTenant?.billing_company_name || currentTenant?.name || '',
          tradeName: currentTenant?.name || '',
          address: [currentTenant?.address, [currentTenant?.postal_code, currentTenant?.city].filter(Boolean).join(' ')].filter(Boolean) as string[],
          vatNo: ctx.runtime.fiscal.vatNo,
          estNo: ctx.runtime.fiscal.estNo,
        },
        staff: { name: ctx.staffName },
      });
      return renderHtml(doc);
    } catch (e) {
      return `<p style="font-family:sans-serif">${t('kassa.pay.ticketError', { detail: e instanceof Error ? e.message : String(e) })}</p>`;
    }
  }, [done, ctx, currentTenant, t]);

  if (done) {
    const change = givenCents !== null ? changeDue(done.plan, givenCents) : null;
    return (
      <Dialog open onOpenChange={(o) => !o && onPaid()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{done.pending ? t('kassa.pay.pendingTitle') : t('kassa.pay.paidTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {done.pending ? <p role="alert" className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t('kassa.pay.pendingText')}</p> : null}
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt>{t('kassa.checks.total')}</dt><dd className="text-right font-bold tabular-nums">{euro(done.plan.total)}</dd>
              {done.plan.cash > 0 ? <><dt>{t('kassa.pay.cashDue')}</dt><dd className="text-right tabular-nums">{euro(done.plan.cashDue)}</dd></> : null}
              {done.plan.tip > 0 ? <><dt>{t('kassa.pay.tip')}</dt><dd className="text-right tabular-nums">{euro(done.plan.tip)}</dd></> : null}
              {change !== null ? <><dt className="font-semibold">{t('kassa.pay.change')}</dt><dd className="text-right text-lg font-bold tabular-nums">{euro(change)}</dd></> : null}
              {done.receiptNumber ? <><dt>{t('kassa.pay.receiptNo')}</dt><dd className="text-right tabular-nums">{done.receiptNumber}</dd></> : null}
            </dl>
            {ticketHtml ? (
              <div className="space-y-2">
                <iframe ref={frame} title={t('kassa.pay.ticket')} srcDoc={ticketHtml} className="h-80 w-full rounded-md border bg-white" />
                <button type="button" onClick={() => frame.current?.contentWindow?.print()} className="flex h-11 w-full items-center justify-center gap-2 rounded-md border font-semibold">
                  <Printer className="h-4 w-4" /> {t('kassa.pay.print')}
                </button>
              </div>
            ) : null}
          </div>
          <DialogFooter><button type="button" onClick={onPaid} className="h-12 w-full rounded-md bg-primary font-semibold text-primary-foreground">{t('kassa.pay.done')}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const cashInPlan = plan && plan.cash > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('kassa.pay.title', { amount: euro(total) })}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAll('cash')} className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border-2 text-base font-semibold', rows.length === 1 && rows[0].method === 'cash' && 'border-primary')}>
              <Banknote className="h-5 w-5" /> {t('kassa.pay.method.cash')}
            </button>
            <button type="button" onClick={() => setAll('card')} className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border-2 text-base font-semibold', rows.length === 1 && rows[0].method === 'card' && 'border-primary')}>
              <CreditCard className="h-5 w-5" /> {t('kassa.pay.method.card')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('kassa.pay.splitEqual')}</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => split(n)} className={cn('h-10 w-10 rounded-md border text-sm font-semibold', rows.length === n && 'border-primary bg-primary/10')}>{n}</button>
            ))}
          </div>

          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <select value={r.method} onChange={(e) => patch(i, { method: e.target.value as TenderMethod })} aria-label={t('kassa.pay.methodLabel')} className="h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm">
                  {TENDER_METHODS.map((m) => <option key={m} value={m}>{t(`kassa.pay.method.${m}`)}</option>)}
                </select>
                <input inputMode="decimal" value={r.amount} onChange={(e) => patch(i, { amount: e.target.value })} aria-label={t('kassa.pay.amount')}
                  className={cn('h-11 w-28 rounded-md border bg-background px-2 text-right tabular-nums', parseEuroInput(r.amount) === null && 'border-destructive')} />
                <button type="button" disabled={rows.length === 1} onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))} aria-label={t('kassa.pay.removeTender')} className="flex h-11 w-11 items-center justify-center rounded-md border disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm">
            <button type="button" disabled={rows.length >= 10} onClick={() => setRows((xs) => [...xs, { method: 'cash', amount: toInput(Math.max(0, rest)) }])} className="flex h-10 items-center gap-1 rounded-md border px-3 font-semibold disabled:opacity-40">
              <Plus className="h-4 w-4" /> {t('kassa.pay.addTender')}
            </button>
            <span className={cn('tabular-nums', rest !== 0 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {rest === 0 ? t('kassa.pay.balanced') : rest > 0 ? t('kassa.pay.remaining', { amount: euro(rest) }) : t('kassa.pay.tooMuch', { amount: euro(-rest) })}
            </span>
          </div>

          {cashInPlan ? (
            <div className="space-y-2 rounded-md bg-muted p-3">
              <p className="flex justify-between text-sm"><span>{t('kassa.pay.cashDue')}</span><span className="font-bold tabular-nums">{euro(plan.cashDue)}</span></p>
              {plan.rounding !== 0 ? <p className="text-xs text-muted-foreground">{t('kassa.pay.roundingNote', { amount: euro(plan.rounding) })}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <input inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} placeholder={t('kassa.pay.given')} aria-label={t('kassa.pay.given')} className="h-11 w-28 rounded-md border bg-background px-2 text-right tabular-nums" />
                {[plan.cashDue, 2000, 5000, 10000].filter((v, i, a) => a.indexOf(v) === i && v >= plan.cashDue).map((v) => (
                  <button key={v} type="button" onClick={() => setGiven(toInput(v))} className="h-10 rounded-md border px-2 text-sm tabular-nums">{euro(v)}</button>
                ))}
              </div>
              {givenCents !== null ? <p className="flex justify-between text-base font-bold"><span>{t('kassa.pay.change')}</span><span className="tabular-nums">{euro(changeDue(plan, givenCents))}</span></p> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t('kassa.pay.tip')}</span>
            <input inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0,00" aria-label={t('kassa.pay.tip')}
              className={cn('h-11 w-24 rounded-md border bg-background px-2 text-right tabular-nums', tipCents === null && 'border-destructive')} />
            <div className="flex rounded-md border" role="group" aria-label={t('kassa.pay.tipMethod')}>
              {(['cash', 'card'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={tipMethod === m} onClick={() => setTipMethod(m)} className={cn('h-10 px-3 text-sm', tipMethod === m && 'bg-muted font-semibold')}>{t(`kassa.pay.method.${m}`)}</button>
              ))}
            </div>
          </div>

          {error ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
          <button type="button" onClick={confirm} disabled={!plan || busy} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.pay.confirm', { amount: euro(total + (plan?.rounding ?? 0)) })}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Apart afrekenen: kies per lijn hoeveel deze klant neemt. */
export function SplitDialog({ check, onClose, onConfirm, busy }: {
  check: Check; busy: boolean; onClose: () => void; onConfirm: (moves: { lineId: string; qty: number }[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const euro = (c: number) => formatEuro(c, i18n.language);
  const lines = check.lines.filter((l) => l.state !== 'void' && l.qty > 0 && (l.state === 'draft' ? l.qty : l.open_qty) > 0).sort((a, b) => a.seq - b.seq);
  const [pick, setPick] = useState<Record<string, number>>({});
  const avail = (id: string) => { const l = lines.find((x) => x.id === id)!; return l.state === 'draft' ? l.qty : l.open_qty; };
  const set = (id: string, q: number) => setPick((p) => ({ ...p, [id]: Math.max(0, Math.min(avail(id), q)) }));
  const picked = Object.entries(pick).filter(([, q]) => q > 0);
  const amount = picked.reduce((s, [id, q]) => {
    const l = lines.find((x) => x.id === id)!;
    return s + Math.round((lineTotalCents(l) * q) / l.qty);
  }, 0);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('kassa.pay.splitTitle')}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('kassa.pay.splitIntro')}</p>
        <ul className="space-y-1.5">
          {lines.map((l) => {
            const q = pick[l.id] ?? 0;
            const max = avail(l.id);
            return (
              <li key={l.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{t('kassa.pay.ofAvailable', { n: max })} · {euro(Math.round(lineTotalCents(l) / l.qty))}</span>
                </span>
                <button type="button" onClick={() => set(l.id, q - 1)} disabled={q === 0} aria-label={t('kassa.checks.less')} className="flex h-10 w-10 items-center justify-center rounded-md border disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                <span className="w-6 text-center font-bold tabular-nums">{q}</span>
                <button type="button" onClick={() => set(l.id, q + 1)} disabled={q >= max} aria-label={t('kassa.checks.more1')} className="flex h-10 w-10 items-center justify-center rounded-md border disabled:opacity-30"><Plus className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
          <button type="button" disabled={!picked.length || busy} onClick={() => onConfirm(picked.map(([lineId, qty]) => ({ lineId, qty })))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{t('kassa.pay.splitConfirm', { amount: euro(amount) })}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
