// TAFEL-1 — één rekening: lijnen links, kaart rechts (op een gsm als tabbladen).
// Tik op een product = +1 (meteen zichtbaar). Tik op een lijn = aantal, opmerking, annuleren
// met reden, korting/van het huis, verplaatsen. Onderaan: Rekening (voorrekening), Verstuur
// (ronde naar keuken/bar) en Afrekenen (TAFEL-2). Apart afrekenen = deelrekening.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChefHat, Loader2, MoreHorizontal, Search, Send, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { cn } from '@/lib/utils';
import { checkTotalCents, isCounter, lineTotalCents, type Check, type CheckLine } from '../horeca/types';
import { kitchenOn, rememberKitchen, rememberService, type CounterService } from '../horeca/counter';
import { roundLines } from '../horeca/fiscalLines';
import { discountLine, moveCheck, moveLines, requestBill, sendRound, type ActionCtx, type ActionOutcome } from '../horeca/actions';
import { useCatalog, type CatalogProduct } from '../horeca/useCatalog';
import { formatEuro } from '../horeca/format';
import { hasPendingPay, isRejectedPay } from '../horeca/payActions';
import { PayDialog, SplitDialog } from './PayDialog';
import { ProductQuickEdit } from './ProductQuickEdit';
import { useLongPress } from '../useLongPress';

interface Props {
  ctx: ActionCtx; checkId: string; onBack: () => void; onOpen?: (checkId: string, opts?: { pay?: boolean }) => void; initialPay?: boolean;
  /** Na afrekenen. TAFEL-3: aan de toog opent de kassa meteen de volgende verkoop. */
  onPaid?: (counter: boolean) => void;
}

const VOID_REASONS = ['mistake', 'customer', 'broken', 'other'] as const;
const DISCOUNTS = [10, 20, 50] as const;

export function CheckScreen({ ctx, checkId, onBack, onOpen, onPaid, initialPay = false }: Props) {
  const { t, i18n } = useTranslation();
  const { store } = ctx;
  const check = store.check(checkId);
  const { data: catalog } = useCatalog(store.tenantId);
  const { data: plan } = useFloorPlan();
  const [tab, setTab] = useState<'lines' | 'menu'>('menu');
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<null | 'send' | 'bill' | 'move' | 'discount' | 'split'>(null);
  const [paying, setPaying] = useState(initialPay);
  const [splitting, setSplitting] = useState(false);
  const [lineSheet, setLineSheet] = useState<CheckLine | null>(null);
  const [addonFor, setAddonFor] = useState<CatalogProduct | null>(null);
  const [moving, setMoving] = useState<null | { lines: CheckLine[] | 'all' }>(null);
  const [kitchen, setKitchen] = useState(kitchenOn);
  // KASSA-0.6: lang drukken op een product = op/terug of prijs, goedgekeurd met de PIN van
  // een eigenaar of verantwoordelijke (de server controleert).
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const euro = (c: number) => formatEuro(c, i18n.language);

  const products = useMemo(() => {
    const all = catalog?.products ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((p) => (term ? p.name.toLowerCase().includes(term) : !cat || p.category_id === cat));
  }, [catalog, cat, q]);

  if (!check) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p>{t('kassa.checks.gone')}</p>
        <button type="button" onClick={onBack} className="h-11 rounded-md border px-4 font-semibold">{t('kassa.checks.backToTables')}</button>
      </div>
    );
  }

  const baseTitle = check.table_id ? t('kassa.checks.table', { label: ctx.tableLabel(check.table_id) ?? '?' }) : check.name;
  const title = check.split_no ? t('kassa.pay.partTitle', { title: baseTitle, n: check.split_no }) : baseTitle;
  // Vergrendeld: een getekende betaling op dit toestel (wachtend of geweigerd), of een ander
  // toestel rekent deze rekening nu af (claim op de server).
  const rejected = isRejectedPay(store.tenantId, check.id);
  const pendingHere = hasPendingPay(store.tenantId, check.id);
  const locked = pendingHere || !!check.paying;
  const visible = check.lines.filter((l) => l.state !== 'void');
  const drafts = roundLines(check).length + check.lines.filter((l) => l.pending && l.state === 'draft').length;
  const sentAny = check.lines.some((l) => l.state === 'sent');
  // TAFEL-3: toogverkoop — geen ronde, geen voorrekening, niet verplaatsen; meteen afrekenen.
  const counter = isCounter(check);
  const service: CounterService = check.service === 'takeaway' ? 'takeaway' : 'eat_in';
  const setService = (s: CounterService) => {
    rememberService(s);
    if (s !== service) store.enqueue({ id: crypto.randomUUID(), kind: 'set_service', check_id: check.id, service: s, staff_id: ctx.staffId });
  };
  // Een lege toogverkoop laten we niet open staan als je terug gaat.
  const back = () => {
    if (counter && !visible.length && !locked) store.enqueue({ id: crypto.randomUUID(), kind: 'void_check', check_id: check.id, staff_id: ctx.staffId });
    onBack();
  };

  const report = (o: ActionOutcome, okMsg?: string) => {
    if (o.ok) { if (okMsg) toast.success(okMsg); return true; }
    toast.error(t(`kassa.checks.error.${o.reason}`, { detail: o.detail ?? '' }));
    return false;
  };

  const addProduct = (p: CatalogProduct, addonIds: string[] = []) => {
    const addons = p.addonGroups.flatMap((g) => g.options).filter((o) => addonIds.includes(o.id)).map((o) => ({ option_id: o.id, name: o.name, price_cents: o.price_cents }));
    // KASSA-0.6: aan de toog bij meenemen het meeneemtarief, zoals de server (kassa_product_vat_rate).
    store.hint(p.id, { name: p.name, unit_price_cents: p.price_cents, vat_label: counter && service === 'takeaway' ? p.vat_label_takeaway : p.vat_label, addons });
    store.enqueue({ id: crypto.randomUUID(), kind: 'add_line', check_id: check.id, line_id: crypto.randomUUID(), product_id: p.id, qty: 1, addon_ids: addonIds, staff_id: ctx.staffId });
  };

  const tapProduct = (p: CatalogProduct) => {
    if (p.sold_out) return;
    if (p.addonGroups.length) setAddonFor(p);
    else addProduct(p);
  };

  const doSend = async () => {
    setBusy('send');
    const o = await sendRound(ctx, check.id);
    setBusy(null);
    if (report(o, t('kassa.checks.sent'))) onBack();
  };
  const openSplit = async () => {
    // Apart afrekenen werkt op verstuurde lijnen: eerst de open ronde versturen.
    if (roundLines(check).length) {
      setBusy('send');
      const o = await sendRound(ctx, check.id);
      setBusy(null);
      if (!report(o)) return;
    }
    setSplitting(true);
  };
  const doSplit = async (moves: { lineId: string; qty: number }[]) => {
    const fresh = store.check(check.id);
    if (!fresh) return;
    setBusy('split');
    const to = crypto.randomUUID();
    const o = await moveLines(ctx, {
      fromCheckId: check.id,
      to: { checkId: to, existing: false, split: true },
      moves: moves.map((m) => ({ line: fresh.lines.find((l) => l.id === m.lineId)!, qty: m.qty })).filter((m) => m.line),
    });
    setBusy(null);
    if (!report(o)) return;
    setSplitting(false);
    // Meteen naar het nieuwe deel en afrekenen.
    onOpen?.(to, { pay: true });
  };
  const doBill = async () => {
    setBusy('bill');
    report(await requestBill(ctx, check.id), t('kassa.checks.billRequested'));
    setBusy(null);
  };

  const lineRow = (l: CheckLine) => (
    <li key={l.id}>
      <button type="button" onClick={() => setLineSheet(l)}
        className={cn('flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left',
          l.state === 'draft' && 'border-primary/60 bg-primary/5', l.qty < 0 && 'text-destructive', l.pending && 'opacity-70')}>
        <span className="w-8 shrink-0 font-bold">{l.qty}×</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{l.name}</span>
          {l.addons.length ? <span className="block truncate text-xs text-muted-foreground">+ {l.addons.map((a) => a.name).join(', ')}</span> : null}
          {l.note ? <span className="block truncate text-xs italic text-muted-foreground">“{l.note}”</span> : null}
          {l.price_changes.map((p) => <span key={p.grouping_id} className="block text-xs text-emerald-700 dark:text-emerald-400">{p.name} {euro(p.amount_cents)}</span>)}
          {l.neg_reason ? <span className="block text-xs">{t(`kassa.checks.reason.${l.neg_reason}`)}</span> : null}
        </span>
        <span className="shrink-0 tabular-nums">{euro(lineTotalCents(l))}</span>
      </button>
    </li>
  );

  const linesPanel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {visible.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">{t('kassa.checks.empty')}</li> : visible.sort((a, b) => a.seq - b.seq).map(lineRow)}
      </ul>
      <div className="flex items-center justify-between border-t px-3 py-2 text-lg font-bold">
        <span>{t('kassa.checks.total')}</span><span className="tabular-nums">{euro(checkTotalCents(check))}</span>
      </div>
    </div>
  );

  const menuPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('kassa.checks.search')} aria-label={t('kassa.checks.search')} className="h-11 w-full rounded-md border bg-background pl-9 pr-3" />
      </label>
      {!q && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" onClick={() => setCat(null)} className={cn('h-10 whitespace-nowrap rounded-full border px-3 text-sm', !cat && 'border-primary bg-primary text-primary-foreground')}>{t('kassa.checks.allCategories')}</button>
          {catalog?.categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} className={cn('h-10 whitespace-nowrap rounded-full border px-3 text-sm', cat === c.id && 'border-primary bg-primary text-primary-foreground')}>{c.name}</button>
          ))}
        </div>
      )}
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
        {!catalog ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : products.map((p) => (
          <ProductTile key={p.id} p={p} onTap={() => tapProduct(p)} onLong={() => setEditing(p)}
            label={p.sold_out ? t('kassa.checks.soldOut') : euro(p.price_cents)} editHint={t('kassa.productEdit.hint')} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <button type="button" onClick={back} aria-label={t('kassa.checks.backToTables')} className="flex h-11 w-11 items-center justify-center rounded-md border"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{title}</p>
          {check.bill_requested_at ? <p className="text-xs text-blue-700 dark:text-blue-300">{t('kassa.checks.billRequestedBadge')}</p> : null}
        </div>
        {counter && (
          <div className="flex rounded-md border" role="group" aria-label={t('kassa.counter.serviceLabel')}>
            {(['eat_in', 'takeaway'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={service === s} disabled={locked} onClick={() => setService(s)}
                className={cn('h-11 px-3 text-sm font-semibold disabled:opacity-40', service === s ? 'bg-primary text-primary-foreground' : '')}>
                {t(`kassa.counter.service.${s}`)}
              </button>
            ))}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('kassa.checks.more')} className="flex h-11 w-11 items-center justify-center rounded-md border"><MoreHorizontal className="h-5 w-5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!counter && <DropdownMenuItem disabled={locked || !sentAny && !drafts} onClick={() => void openSplit()}>{t('kassa.pay.split')}</DropdownMenuItem>}
            {!counter && <DropdownMenuItem disabled={locked || !!check.split_of} onClick={() => setMoving({ lines: 'all' })}>{t('kassa.checks.moveCheck')}</DropdownMenuItem>}
            {!sentAny && !locked && (
              <DropdownMenuItem onClick={async () => {
                const r = await store.applyNow({ id: crypto.randomUUID(), kind: 'void_check', check_id: check.id, staff_id: ctx.staffId }).catch(() => null);
                if (r?.ok) onBack(); else toast.error(t('kassa.checks.error.server', { detail: r?.error ?? '' }));
              }}>{t('kassa.checks.deleteCheck')}</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex border-b lg:hidden" role="tablist">
        {(['lines', 'menu'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={cn('h-11 flex-1 text-sm font-semibold', tab === x ? 'border-b-2 border-primary' : 'text-muted-foreground')}>
            {x === 'lines' ? t('kassa.checks.tabLines', { n: visible.length }) : t('kassa.checks.tabMenu')}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className={cn('min-h-0 flex-col border-r lg:flex lg:w-[42%]', tab === 'lines' ? 'flex w-full' : 'hidden')}>{linesPanel}</div>
        <div className={cn('min-h-0 flex-1 flex-col lg:flex', tab === 'menu' ? 'flex' : 'hidden')}>{menuPanel}</div>
      </div>

      {locked ? (
        <p role="alert" className={cn('border-t px-3 py-2 text-sm', rejected ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100')}>
          {t(rejected ? 'kassa.pay.lockedRejected' : pendingHere ? 'kassa.pay.lockedPending' : 'kassa.pay.lockedPaying')}
        </p>
      ) : null}
      {counter ? (
        <div className="grid grid-cols-3 gap-2 border-t p-2" style={{ paddingBottom: 'max(0.5rem, var(--safe-bottom))' }}>
          <button type="button" aria-pressed={kitchen} onClick={() => { rememberKitchen(!kitchen); setKitchen(!kitchen); }}
            className={cn('flex h-14 items-center justify-center gap-2 rounded-lg border text-base font-semibold', kitchen ? 'border-primary text-primary' : 'text-muted-foreground')}>
            <ChefHat className="h-5 w-5" /> <span className="truncate">{t(kitchen ? 'kassa.counter.kitchenOn' : 'kassa.counter.kitchenOff')}</span>
          </button>
          <button type="button" onClick={() => setPaying(true)} disabled={locked || !!busy || !visible.length}
            className="col-span-2 flex h-14 items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
            <Wallet className="h-5 w-5" /> {t('kassa.pay.button')} · {euro(checkTotalCents(check))}
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2 border-t p-2" style={{ paddingBottom: 'max(0.5rem, var(--safe-bottom))' }}>
        <button type="button" onClick={doBill} disabled={locked || !!busy || !sentAny && !drafts}
          className="flex h-14 items-center justify-center gap-2 rounded-lg border text-base font-semibold disabled:opacity-40">
          {busy === 'bill' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Receipt className="h-5 w-5" />} {t('kassa.checks.bill')}
        </button>
        <button type="button" onClick={doSend} disabled={locked || !!busy || drafts === 0}
          className="flex h-14 items-center justify-center gap-2 rounded-lg border-2 border-primary text-base font-semibold text-primary disabled:opacity-40">
          {busy === 'send' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} {t('kassa.checks.send', { n: drafts })}
        </button>
        <button type="button" onClick={() => setPaying(true)} disabled={locked || !!busy || (!sentAny && !drafts)}
          className="flex h-14 items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
          <Wallet className="h-5 w-5" /> {t('kassa.pay.button')}
        </button>
      </div>
      )}

      {paying && (
        <PayDialog ctx={ctx} check={check} kitchen={counter ? kitchen : undefined} onClose={() => setPaying(false)}
          onPaid={() => { setPaying(false); if (onPaid) onPaid(counter); else onBack(); }} />
      )}
      {splitting && (
        <SplitDialog check={store.check(check.id) ?? check} busy={busy === 'split'} onClose={() => setSplitting(false)} onConfirm={doSplit} />
      )}

      {lineSheet && (
        <LineDialog line={check.lines.find((l) => l.id === lineSheet.id) ?? lineSheet} busy={busy === 'discount'} canMove={!counter} onClose={() => setLineSheet(null)}
          onQty={(qty) => store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: lineSheet.id, qty, staff_id: ctx.staffId })}
          onNote={(note) => store.enqueue({ id: crypto.randomUUID(), kind: 'set_note', check_id: check.id, line_id: lineSheet.id, note, staff_id: ctx.staffId })}
          onVoid={(reason, qty) => {
            store.enqueue({ id: crypto.randomUUID(), kind: 'void_line', check_id: check.id, line_id: lineSheet.id, new_line_id: crypto.randomUUID(), reason, qty, staff_id: ctx.staffId });
            setLineSheet(null);
          }}
          onDiscount={async (d) => {
            setBusy('discount');
            const ok = report(await discountLine(ctx, check.id, lineSheet.id, d));
            setBusy(null);
            if (ok) setLineSheet(null);
          }}
          onMove={() => { setMoving({ lines: [lineSheet] }); setLineSheet(null); }}
        />
      )}

      {editing ? <ProductQuickEdit ctx={ctx} product={catalog?.products.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} /> : null}
      {addonFor && (
        <AddonDialog product={addonFor} onClose={() => setAddonFor(null)} onConfirm={(ids) => { addProduct(addonFor, ids); setAddonFor(null); }} />
      )}

      {moving && plan && (
        <MoveDialog check={check} checks={store.checks} tables={plan.tables} tableLabel={ctx.tableLabel} busy={busy === 'move'}
          lines={moving.lines}
          onClose={() => setMoving(null)}
          onPick={async (target) => {
            setBusy('move');
            let o: ActionOutcome;
            if (moving.lines === 'all' && target.kind !== 'existing') {
              o = await moveCheck(ctx, check.id, target.kind === 'table' ? { tableId: target.tableId, name: null } : { tableId: null, name: target.name });
            } else {
              const lines = moving.lines === 'all' ? check.lines.filter((l) => l.qty > 0 && l.state !== 'void' && (l.state === 'draft' || l.open_qty > 0)) : moving.lines;
              o = await moveLines(ctx, {
                fromCheckId: check.id,
                to: target.kind === 'existing' ? { checkId: target.checkId, existing: true }
                  : { checkId: crypto.randomUUID(), existing: false, tableId: target.kind === 'table' ? target.tableId : null, name: target.kind === 'name' ? target.name : null },
                moves: lines.map((l) => ({ line: l, qty: l.state === 'draft' ? l.qty : l.open_qty })),
              });
            }
            setBusy(null);
            if (report(o, t('kassa.checks.moved'))) { setMoving(null); if (moving.lines === 'all') onBack(); }
          }}
        />
      )}
    </div>
  );

}

function LineDialog(p: {
  line: CheckLine; busy: boolean; canMove: boolean; onClose: () => void; onQty: (q: number) => void; onNote: (n: string) => void;
  onVoid: (reason: string, qty: number) => void; onDiscount: (d: { percent?: number; name: string }) => void; onMove: () => void;
}) {
  const { t } = useTranslation();
  const l = p.line;
  const [note, setNote] = useState(l.note ?? '');
  const [voidQty, setVoidQty] = useState(l.state === 'draft' ? l.qty : Math.max(1, l.open_qty));
  const [askReason, setAskReason] = useState(false);
  const editable = l.state === 'draft';
  const canAct = l.qty > 0 && (editable || l.open_qty > 0);
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{l.qty}× {l.name}</DialogTitle></DialogHeader>
        {!canAct ? <p className="text-sm text-muted-foreground">{t('kassa.checks.lineLocked')}</p> : (
          <div className="space-y-4">
            {editable && (
              <div className="flex items-center justify-center gap-4">
                <button type="button" aria-label={t('kassa.checks.less')} onClick={() => p.onQty(Math.max(0, l.qty - 1))} className="h-14 w-14 rounded-full border text-2xl font-bold">−</button>
                <span className="w-10 text-center text-2xl font-bold tabular-nums">{l.qty}</span>
                <button type="button" aria-label={t('kassa.checks.more1')} onClick={() => p.onQty(Math.min(999, l.qty + 1))} className="h-14 w-14 rounded-full border text-2xl font-bold">+</button>
              </div>
            )}
            {editable && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); p.onNote(note); p.onClose(); }}>
                <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('kassa.checks.notePlaceholder')} aria-label={t('kassa.checks.note')} className="h-11 flex-1 rounded-md border bg-background px-3" />
                <button type="submit" className="h-11 rounded-md border px-3 text-sm font-semibold">{t('kassa.common.save')}</button>
              </form>
            )}
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('kassa.checks.discount')}</p>
              <div className="flex flex-wrap gap-2">
                {DISCOUNTS.map((d) => (
                  <button key={d} type="button" disabled={p.busy || l.price_changes.length > 0} onClick={() => p.onDiscount({ percent: d, name: t('kassa.checks.discountName', { n: d }) })}
                    className="h-11 rounded-md border px-3 text-sm font-semibold disabled:opacity-40">−{d} %</button>
                ))}
                <button type="button" disabled={p.busy || l.price_changes.length > 0} onClick={() => p.onDiscount({ percent: 100, name: t('kassa.checks.onTheHouse') })}
                  className="h-11 rounded-md border px-3 text-sm font-semibold disabled:opacity-40">{t('kassa.checks.onTheHouse')}</button>
              </div>
            </div>
            {!askReason ? (
              <div className={cn('grid gap-2', p.canMove ? 'grid-cols-2' : 'grid-cols-1')}>
                {p.canMove && <button type="button" onClick={p.onMove} className="h-11 rounded-md border text-sm font-semibold">{t('kassa.checks.moveLine')}</button>}
                <button type="button" onClick={() => (editable ? p.onVoid('mistake', l.qty) : setAskReason(true))} className="h-11 rounded-md border border-destructive text-sm font-semibold text-destructive">
                  {editable ? t('kassa.checks.remove') : t('kassa.checks.cancelLine')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {l.open_qty > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{t('kassa.checks.howMany')}</span>
                    <button type="button" onClick={() => setVoidQty((v) => Math.max(1, v - 1))} className="h-10 w-10 rounded-full border">−</button>
                    <span className="w-6 text-center font-bold">{voidQty}</span>
                    <button type="button" onClick={() => setVoidQty((v) => Math.min(l.open_qty, v + 1))} className="h-10 w-10 rounded-full border">+</button>
                  </div>
                )}
                <p className="text-sm font-semibold">{t('kassa.checks.why')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {VOID_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => p.onVoid(r, voidQty)} className="h-11 rounded-md border text-sm">{t(`kassa.checks.voidReason.${r}`)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter><button type="button" onClick={p.onClose} className="h-11 rounded-md border px-4">{t('kassa.common.close')}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddonDialog({ product, onClose, onConfirm }: { product: CatalogProduct; onClose: () => void; onConfirm: (ids: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (groupMax: number | null, groupIds: string[], id: string) => {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      const inGroup = cur.filter((x) => groupIds.includes(x));
      if (groupMax === 1) return [...cur.filter((x) => !groupIds.includes(x)), id];
      if (groupMax != null && inGroup.length >= groupMax) return cur;
      return [...cur, id];
    });
  };
  const valid = product.addonGroups.every((g) => {
    const n = picked.filter((x) => g.options.some((o) => o.id === x)).length;
    return n >= g.min && (g.max == null || n <= g.max);
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{product.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {product.addonGroups.map((g) => (
            <fieldset key={g.id} className="space-y-2">
              <legend className="text-sm font-semibold">{g.name}{g.min > 0 ? ` · ${t('kassa.checks.required')}` : ''}</legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = picked.includes(o.id);
                  return (
                    <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(g.max, g.options.map((x) => x.id), o.id)}
                      className={cn('h-11 rounded-md border px-3 text-sm', on && 'border-primary bg-primary text-primary-foreground')}>
                      {o.name}{o.price_cents ? ` +${formatEuro(o.price_cents, i18n.language)}` : ''}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
          <button type="button" disabled={!valid} onClick={() => onConfirm(picked)} className="h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">{t('kassa.checks.add')}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MoveTarget = { kind: 'existing'; checkId: string } | { kind: 'table'; tableId: string } | { kind: 'name'; name: string };

function MoveDialog(p: {
  check: Check; checks: Check[]; tables: { id: string; label: string; area_id: string }[]; tableLabel: (id: string | null) => string | null;
  lines: CheckLine[] | 'all'; busy: boolean; onClose: () => void; onPick: (t: MoveTarget) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const byTable = new Map(p.checks.filter((c) => c.table_id && !c.split_of).map((c) => [c.table_id as string, c]));
  const others = p.checks.filter((c) => c.id !== p.check.id && (!c.table_id || c.split_of));
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{p.lines === 'all' ? t('kassa.checks.moveCheckTitle') : t('kassa.checks.moveLineTitle')}</DialogTitle></DialogHeader>
        {p.busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[...p.tables].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })).filter((tb) => tb.id !== p.check.table_id).map((tb) => {
                const c = byTable.get(tb.id);
                return (
                  <button key={tb.id} type="button" onClick={() => p.onPick(c ? { kind: 'existing', checkId: c.id } : { kind: 'table', tableId: tb.id })}
                    className={cn('flex min-h-14 flex-col items-center justify-center rounded-lg border-2 p-1', c ? 'border-emerald-500' : 'border-slate-300')}>
                    <span className="font-bold">{tb.label}</span>
                    <span className="text-xs text-muted-foreground">{c ? t('kassa.checks.merge') : t('kassa.tables.free')}</span>
                  </button>
                );
              })}
            </div>
            {others.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {others.map((c) => (
                  <button key={c.id} type="button" onClick={() => p.onPick({ kind: 'existing', checkId: c.id })} className="h-11 rounded-full border px-4 text-sm font-semibold">
                    {c.split_no ? t('kassa.pay.partTitle', { title: c.table_id ? p.tableLabel(c.table_id) ?? '?' : c.name, n: c.split_no }) : c.name}
                  </button>
                ))}
              </div>
            )}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) p.onPick({ kind: 'name', name: name.trim() }); }}>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('kassa.tables.namePlaceholder')} aria-label={t('kassa.tables.namePlaceholder')} className="h-11 flex-1 rounded-md border bg-background px-3" />
              <button type="submit" disabled={!name.trim()} className="h-11 rounded-md border px-3 text-sm font-semibold disabled:opacity-40">{t('kassa.tables.onName')}</button>
            </form>
          </div>
        )}
        <DialogFooter><button type="button" onClick={p.onClose} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** KASSA-0.6 — producttegel: tikken = +1; lang drukken = op/terug of prijs aanpassen. */
function ProductTile({ p, onTap, onLong, label, editHint }: { p: CatalogProduct; onTap: () => void; onLong: () => void; label: string; editHint: string }) {
  const lp = useLongPress(onLong, true);
  // Een uitverkocht product blijft aanraakbaar (lang drukken om het terug te zetten).
  return (
    <button type="button" aria-disabled={p.sold_out || undefined} title={editHint}
      onClick={() => { if (lp.consumeClick()) return; if (p.sold_out) { toast.info(`${p.name}: ${label}`); return; } onTap(); }} {...lp.handlers}
      className={cn('flex min-h-20 select-none flex-col justify-between rounded-lg border bg-card p-2.5 text-left [-webkit-touch-callout:none] active:scale-[0.98] disabled:opacity-40', p.sold_out && 'opacity-40')}>
      <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
      <span className="text-sm tabular-nums text-muted-foreground">{label}</span>
    </button>
  );
}
