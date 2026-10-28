// TAFEL-2 — afrekenen van één rekening.
//
// Snel: "Contant" of "Kaart" voor het hele bedrag. Delen: in n gelijke delen, elk met een
// eigen betaalmiddel (één btw-kasticket, UC4119). Vrij: betaalmiddelen en bedragen zelf.
// Contant toont het afgeronde bedrag (5 cent) en het wisselgeld; fooi staat apart.
// Na afloop: bonnummer, wisselgeld en (geregistreerde kassa) het kasticket om af te drukken.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, Landmark, Loader2, Minus, Plus, Printer, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { formatIBAN, generateEPCString } from '@/lib/epcQrCode';
import { generateOGM } from '@/lib/ogm';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import { buildKasticket, renderHtml } from '../../print';
import type { ActionCtx } from '../horeca/actions';
import { changeDue, equalSplit, parseEuroInput, planPayment, transferDue, type PaymentPlan, type Tender, type TenderMethod, type TipMethod } from '../horeca/pay';
import { availableTenders, availableTipMethods, useKassaPaySettings } from '../horeca/paySettings';
import { payableTotal, payCheck, type PayOutcome } from '../horeca/payActions';
import { isCounter, lineTotalCents, type Check } from '../horeca/types';
import { formatEuro } from '../horeca/format';

const toInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

interface Row { method: TenderMethod; amount: string }

export function PayDialog({ ctx, check, onClose, onPaid, kitchen }: { ctx: ActionCtx; check: Check; onClose: () => void; onPaid: () => void; kitchen?: boolean }) {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const euro = (c: number) => formatEuro(c, i18n.language);
  // Wat nog niet verstuurd is, gaat bij afrekenen eerst mee; het totaal telt het dus al mee.
  // Aan de toog (TAFEL-3) zijn de ontwerp-lijnen zelf wat afgerekend wordt.
  const total = useMemo(() => payableTotal(check) + (isCounter(check) ? 0 : check.lines.filter((l) => l.state === 'draft').reduce((s, l) => s + lineTotalCents(l), 0)), [check]);
  // BETAAL-1: enkel de betaalwijzen die de zaak aanbiedt (Kassa › Betalen).
  const paySettings = useKassaPaySettings(currentTenant?.id);
  const methods = useMemo(() => availableTenders(paySettings), [paySettings]);
  const tipMethods = useMemo(() => availableTipMethods(paySettings), [paySettings]);
  const firstMethod: TenderMethod = methods[0] ?? 'cash';
  const [rows, setRows] = useState<Row[]>([{ method: firstMethod, amount: toInput(total) }]);
  const [tip, setTip] = useState('');
  const [tipMethod, setTipMethod] = useState<TipMethod>(tipMethods[0] ?? 'cash');
  // Laden de instellingen pas na het openen, dan volgt een betaalwijze die er niet (meer) is mee.
  // Review B1: enkel een nieuwe state als er echt iets moet wijzigen, en deps op de inhoud (niet op de array).
  const methodsKey = methods.join(',');
  const tipKey = tipMethods.join(',');
  useEffect(() => {
    setRows((xs) => (xs.every((x) => methods.includes(x.method)) ? xs : xs.map((x) => (methods.includes(x.method) ? x : { ...x, method: firstMethod }))));
    setTipMethod((m) => (tipMethods.includes(m) ? m : tipMethods[0] ?? 'cash'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- methods/tipMethods volgen uit de keys
  }, [methodsKey, tipKey, firstMethod]);
  // Overschrijving: één gestructureerde mededeling per afrekening, in de QR en bij de betaling bewaard.
  const ogm = useMemo(() => generateOGM(Date.now()), []);
  const iban = (currentTenant as { iban?: string | null } | null)?.iban?.replace(/\s/g, '') || '';
  // Review Mag-1: "gezien" geldt voor één bedrag; wijzigt het, dan is het meteen weer uit (geen effect nodig).
  const [seenFor, setSeenFor] = useState<number | null>(null);
  const [given, setGiven] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<PayOutcome, { ok: true }> | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // Wijzigt het totaal terwijl het venster open is (collega tikte iets aan), dan volgt één
  // enkel betaalmiddel mee; bij meerdere toont de kassa wat er nog openstaat.
  const lastTotal = useRef(total);
  useEffect(() => {
    if (lastTotal.current === total) return;
    lastTotal.current = total;
    setRows((xs) => (xs.length === 1 ? [{ ...xs[0], amount: toInput(total) }] : xs));
  }, [total]);

  const tenders: Tender[] | null = useMemo(() => {
    const out: Tender[] = [];
    for (const r of rows) {
      const c = parseEuroInput(r.amount);
      if (c === null) return null;
      if (c > 0) out.push(r.method === 'transfer' ? { method: r.method, amount_cents: c, reference: ogm } : { method: r.method, amount_cents: c });
    }
    return out;
  }, [rows, ogm]);
  // Review Mag-2: zonder fooiwijzen (fooi uit) telt een eerder ingetikte fooi niet mee.
  const tipCents = tipMethods.length && tip.trim() ? parseEuroInput(tip) : 0;
  const plan: PaymentPlan | null = useMemo(() => {
    if (!tenders || tipCents === null) return null;
    try { return planPayment(total, tenders, tipCents, tipCents > 0 && tipMethods.length ? tipMethod : null); } catch { return null; }
  }, [tenders, tipCents, tipMethod, tipMethods, total]);
  const transferCents = plan ? transferDue(plan) : 0;
  const transferSeen = transferCents > 0 && seenFor === transferCents;
  const transferBlocked = transferCents > 0 && (!iban || !transferSeen);
  const entered = (tenders ?? []).reduce((s, x) => s + x.amount_cents, 0);
  const rest = total - entered;
  const givenCents = given.trim() ? parseEuroInput(given) : null;

  const setAll = (method: TenderMethod) => { setRows([{ method, amount: toInput(total) }]); setError(null); };
  const split = (n: number) => { setRows(equalSplit(total, n).map((c, i) => ({ method: rows[i]?.method ?? firstMethod, amount: toInput(c) }))); setError(null); };
  const patch = (i: number, r: Partial<Row>) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, ...r } : x)));

  const confirm = async () => {
    if (!plan || !tenders || transferBlocked) return;
    setBusy(true);
    setError(null);
    const o = await payCheck(ctx, check.id, tenders, plan.tip, plan.tipMethod, { kitchen });
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
  const quick = methods.filter((m) => m === 'cash' || m === 'transfer' || m === 'card');
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t('kassa.pay.title', { amount: euro(total) })}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className={cn('grid gap-2', quick.length >= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {quick.map((m) => {
              const Icon = m === 'cash' ? Banknote : m === 'card' ? CreditCard : Landmark;
              return (
                <button key={m} type="button" onClick={() => setAll(m)} className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border-2 text-base font-semibold', rows.length === 1 && rows[0].method === m && 'border-primary')}>
                  <Icon className="h-5 w-5" /> {t(`kassa.pay.method.${m}`)}
                </button>
              );
            })}
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
                  {methods.map((m) => <option key={m} value={m}>{t(`kassa.pay.method.${m}`)}</option>)}
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
            <button type="button" disabled={rows.length >= 10} onClick={() => setRows((xs) => [...xs, { method: firstMethod, amount: toInput(Math.max(0, rest)) }])} className="flex h-10 items-center gap-1 rounded-md border px-3 font-semibold disabled:opacity-40">
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

          {transferCents > 0 ? (
            <div className="space-y-2 rounded-md bg-muted p-3">
              {iban ? (
                <>
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                    <div className="rounded-md bg-white p-2">
                      <QRCode
                        size={168}
                        value={generateEPCString({
                          beneficiaryName: currentTenant?.billing_company_name || currentTenant?.name || '',
                          iban,
                          amount: transferCents / 100,
                          reference: ogm,
                        })}
                      />
                    </div>
                    <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">{t('kassa.pay.transfer.amount')}</dt><dd className="text-right font-bold tabular-nums">{euro(transferCents)}</dd>
                      <dt className="text-muted-foreground">{t('kassa.pay.transfer.iban')}</dt><dd className="text-right font-mono text-xs">{formatIBAN(iban)}</dd>
                      <dt className="text-muted-foreground">{t('kassa.pay.transfer.reference')}</dt><dd className="text-right font-mono text-xs">{ogm}</dd>
                    </dl>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('kassa.pay.transfer.hint')}</p>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border bg-background px-3 text-sm font-semibold">
                    <input type="checkbox" checked={transferSeen} onChange={(e) => setSeenFor(e.target.checked ? transferCents : null)} className="h-5 w-5" />
                    {t('kassa.pay.transfer.seen')}
                  </label>
                </>
              ) : (
                <p role="alert" className="text-sm text-destructive">{t('kassa.pay.transfer.noIban')}</p>
              )}
            </div>
          ) : null}

          {tipMethods.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t('kassa.pay.tip')}</span>
            <input inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0,00" aria-label={t('kassa.pay.tip')}
              className={cn('h-11 w-24 rounded-md border bg-background px-2 text-right tabular-nums', tipCents === null && 'border-destructive')} />
            <div className="flex rounded-md border" role="group" aria-label={t('kassa.pay.tipMethod')}>
              {tipMethods.map((m) => (
                <button key={m} type="button" aria-pressed={tipMethod === m} onClick={() => setTipMethod(m)} className={cn('h-10 px-3 text-sm', tipMethod === m && 'bg-muted font-semibold')}>{t(`kassa.pay.method.${m}`)}</button>
              ))}
            </div>
          </div>
          ) : null}

          {error ? <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-md border px-4">{t('kassa.common.cancel')}</button>
          <button type="button" onClick={confirm} disabled={!plan || busy || transferBlocked} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
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
