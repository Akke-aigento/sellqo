// TAFEL-1 — één rekening: lijnen links, kaart rechts (op een gsm als tabbladen).
// Tik op een product = +1 (meteen zichtbaar). Tik op een lijn = aantal, opmerking, annuleren
// met reden, korting/van het huis, verplaatsen. Onderaan: Rekening (voorrekening), Verstuur
// (ronde naar keuken/bar) en Afrekenen (TAFEL-2). Apart afrekenen = deelrekening.
// KASSA-UX-1: zelfde product nog eens tikken telt op dezelfde lijn op; de tegel toont het aantal
// in deze ronde met een "−"; op een gsm toont een balk onderaan aantal en totaal en wisselt
// tussen kaart en rekening; de kaart opent op Populair (of de eerste categorie), niet op alles.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChefHat, ChevronDown, ChevronUp, Flame, Loader2, Minus, MoreHorizontal, Search, Send, Receipt, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { cn } from '@/lib/utils';
import { checkTotalCents, isCounter, lineTotalCents, type Check, type CheckLine } from '../horeca/types';
import { kitchenOn, rememberKitchen, rememberService, type CounterService } from '../horeca/counter';
import { roundLines } from '../horeca/fiscalLines';
import { discountLine, moveCheck, moveLines, requestBill, sendRound, type ActionCtx, type ActionOutcome } from '../horeca/actions';
import { useCatalog, usePopularLines, type CatalogProduct } from '../horeca/useCatalog';
import { categoryDot, categoryTone, draftCountWith, draftCounts, isQuickChoice, itemCount, planMinus, planTap, popularIds } from '../horeca/quickTap';
import { formatEuro } from '../horeca/format';
import { hasPendingPay, isRejectedPay } from '../horeca/payActions';
import { PayDialog, SplitDialog } from './PayDialog';
import { ProductQuickEdit } from './ProductQuickEdit';
import { useLongPress } from '../useLongPress';

interface Props {
  ctx: ActionCtx; checkId: string; onBack: () => void; onOpen?: (checkId: string, opts?: { pay?: boolean }) => void; initialPay?: boolean;
  /** KASSA-UX-3: meteen het venster "verplaatsen of samenvoegen" (lang drukken op een tafel). */
  initialMove?: boolean;
  /** Na afrekenen. TAFEL-3: aan de toog opent de kassa meteen de volgende verkoop. */
  onPaid?: (counter: boolean) => void;
}

const VOID_REASONS = ['mistake', 'customer', 'broken', 'other'] as const;
const POPULAR = '__popular';
const ALL = '__all';
const DISCOUNTS = [10, 20, 50] as const;

export function CheckScreen({ ctx, checkId, onBack, onOpen, onPaid, initialPay = false, initialMove = false }: Props) {
  const { t, i18n } = useTranslation();
  const { store } = ctx;
  const check = store.check(checkId);
  const { data: catalog } = useCatalog(store.tenantId);
  const { data: plan } = useFloorPlan();
  const { data: soldLines } = usePopularLines(store.tenantId);
  const [tab, setTab] = useState<'lines' | 'menu'>('menu');
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  // Korte oplichting van de tegel die net getikt is.
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState<null | 'send' | 'bill' | 'move' | 'discount' | 'split'>(null);
  const [paying, setPaying] = useState(initialPay);
  const [splitting, setSplitting] = useState(false);
  const [lineSheet, setLineSheet] = useState<CheckLine | null>(null);
  const [addonFor, setAddonFor] = useState<CatalogProduct | null>(null);
  const [moving, setMoving] = useState<null | { lines: CheckLine[] | 'all' }>(initialMove ? { lines: 'all' } : null);
  const [confirmBill, setConfirmBill] = useState(false);
  const [kitchen, setKitchen] = useState(kitchenOn);
  // KASSA-0.6: lang drukken op een product = op/terug of prijs, goedgekeurd met de PIN van
  // een eigenaar of verantwoordelijke (de server controleert).
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const euro = (c: number) => formatEuro(c, i18n.language);

  const popular = useMemo(() => {
    const all = catalog?.products ?? [];
    return popularIds(soldLines ?? [], new Set(all.map((p) => p.id)));
  }, [catalog, soldLines]);
  // Standaard: Populair als er genoeg verkoopgegevens zijn, anders de eerste categorie.
  const activeCat = cat ?? (popular.length ? POPULAR : catalog?.categories[0]?.id ?? ALL);
  const catIndex = useMemo(() => new Map((catalog?.categories ?? []).map((c, i) => [c.id, i])), [catalog]);
  const products = useMemo(() => {
    const all = catalog?.products ?? [];
    const term = q.trim().toLowerCase();
    if (term) return all.filter((p) => p.name.toLowerCase().includes(term));
    if (activeCat === ALL) return all;
    if (activeCat === POPULAR) {
      const byId = new Map(all.map((p) => [p.id, p]));
      return popular.map((id) => byId.get(id)).filter(Boolean) as CatalogProduct[];
    }
    return all.filter((p) => p.category_id === activeCat);
  }, [catalog, activeCat, q, popular]);

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

  /** Eén erbij: optellen op een lijn met precies hetzelfde product en dezelfde extra's, anders een nieuwe lijn. */
  const addOne = (p: CatalogProduct, addonIds: string[] = []) => {
    // Trillen waar het toestel dat kan (Android); de oplichting is er altijd.
    try { navigator.vibrate?.(12); } catch { /* geen trilfunctie */ }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(p.id);
    flashTimer.current = setTimeout(() => setFlash(null), 180);
    const fresh = store.check(check.id) ?? check;
    const plan = planTap(fresh, p.id, addonIds);
    if (plan.kind === 'qty') store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: plan.lineId, qty: plan.qty, staff_id: ctx.staffId });
    else addProduct(p, addonIds);
  };
  const tapProduct = (p: CatalogProduct) => {
    if (p.sold_out) return;
    if (p.addonGroups.length) { setAddonFor(p); return; }
    addOne(p);
  };
  const minusProduct = (p: CatalogProduct) => {
    const m = planMinus(check, p.id);
    if (m) store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: m.lineId, qty: m.qty, staff_id: ctx.staffId });
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
    setConfirmBill(false);
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
      {/* Op gsm staat het totaal al in de balk onderaan. */}
      <div className="hidden items-center justify-between border-t px-3 py-2 text-lg font-bold lg:flex">
        <span>{t('kassa.checks.total')}</span><span className="tabular-nums">{euro(checkTotalCents(check))}</span>
      </div>
    </div>
  );

  const counts = draftCounts(check);
  const chip = (id: string, label: ReactNode, dot?: string) => (
    <button key={id} type="button" aria-pressed={activeCat === id} onClick={() => setCat(id)}
      className={cn('flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold',
        activeCat === id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}>
      {dot ? <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', dot)} /> : null}{label}
    </button>
  );
  const menuPanel = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3">
      {searching ? (
        <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('kassa.checks.search')} aria-label={t('kassa.checks.search')} className="h-11 w-full rounded-md border bg-background pl-9 pr-3" />
          </label>
          <button type="button" aria-label={t('kassa.checks.closeSearch')} onClick={() => { setSearching(false); setQ(''); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border"><X className="h-5 w-5" /></button>
        </form>
      ) : (
        // Alle categorieën in één oogopslag (meerdere rijen), niet verstopt achter horizontaal scrollen.
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <button type="button" aria-label={t('kassa.checks.search')} onClick={() => setSearching(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"><Search className="h-4 w-4" /></button>
          {popular.length > 0 && chip(POPULAR, <><Flame className="h-4 w-4" aria-hidden />{t('kassa.checks.popular')}</>)}
          {catalog?.categories.map((c, i) => chip(c.id, c.name, categoryDot(i)))}
          {chip(ALL, t('kassa.checks.allCategories'))}
        </div>
      )}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4 sm:gap-2 md:grid-cols-5 xl:grid-cols-6">
        {!catalog ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : products.map((p) => (
          <ProductTile key={p.id} p={p} count={counts.get(p.id) ?? 0} flash={flash === p.id} tone={categoryTone(p.category_id ? catIndex.get(p.category_id) ?? -1 : -1)}
            onTap={() => tapProduct(p)} onLong={() => setEditing(p)} onMinus={() => minusProduct(p)}
            label={p.sold_out ? t('kassa.checks.soldOut') : euro(p.price_cents)} editHint={t('kassa.productEdit.hint')} minusLabel={t('kassa.checks.minusOne', { name: p.name })} />
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
        <span className="hidden text-lg font-bold tabular-nums lg:inline">{euro(checkTotalCents(check))}</span>
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
            {/* KASSA-UX-3: de keukenbon aan de toog gaat vanzelf (enkel wat niet naar de bar gaat); hier de uitzondering. */}
            {counter && (
              <DropdownMenuItem onClick={() => { rememberKitchen(!kitchen); setKitchen(!kitchen); }}>
                {t(kitchen ? 'kassa.counter.withoutKitchen' : 'kassa.counter.withKitchen')}
              </DropdownMenuItem>
            )}
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

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className={cn('min-h-0 min-w-0 flex-col border-r lg:flex lg:w-[38%]', tab === 'lines' ? 'flex w-full' : 'hidden')}>{linesPanel}</div>
        <div className={cn('min-h-0 min-w-0 flex-1 flex-col lg:flex', tab === 'menu' ? 'flex' : 'hidden')}>{menuPanel}</div>
      </div>

      {/* Gsm/kleine tablet: aantal en totaal altijd in beeld; tikken wisselt tussen kaart en rekening. */}
      <button type="button" onClick={() => setTab(tab === 'menu' ? 'lines' : 'menu')} aria-expanded={tab === 'lines'}
        className="flex h-12 items-center gap-2 border-t bg-muted/60 px-3 text-left lg:hidden">
        <span className="min-w-0 flex-1 truncate font-semibold">{t('kassa.checks.summary', { count: itemCount(check) })} · <span className="tabular-nums">{euro(checkTotalCents(check))}</span></span>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary">
          {tab === 'menu' ? <>{t('kassa.checks.showLines')}<ChevronUp className="h-4 w-4" /></> : <>{t('kassa.checks.tabMenu')}<ChevronDown className="h-4 w-4" /></>}
        </span>
      </button>

      {locked ? (
        <p role="alert" className={cn('border-t px-3 py-2 text-sm', rejected ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100')}>
          {t(rejected ? 'kassa.pay.lockedRejected' : pendingHere ? 'kassa.pay.lockedPending' : 'kassa.pay.lockedPaying')}
        </p>
      ) : null}
      {counter ? (
        <div className="grid gap-2 border-t p-2" style={{ paddingBottom: 'max(0.5rem, var(--safe-bottom))' }}>
          {!kitchen && <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><ChefHat className="h-3.5 w-3.5" aria-hidden />{t('kassa.counter.noKitchenNote')}</p>}
          <button type="button" onClick={() => setPaying(true)} disabled={locked || !!busy || !visible.length}
            className="flex h-14 items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
            <Wallet className="h-5 w-5" /> {t('kassa.pay.button')} · {euro(checkTotalCents(check))}
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2 border-t p-2" style={{ paddingBottom: 'max(0.5rem, var(--safe-bottom))' }}>
        <button type="button" onClick={() => setConfirmBill(true)} disabled={locked || !!busy || !sentAny && !drafts}
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

      <Dialog open={confirmBill} onOpenChange={setConfirmBill}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('kassa.checks.billConfirmTitle', { title })}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('kassa.checks.billConfirmText', { amount: euro(checkTotalCents(check)) })}</p>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmBill(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={() => void doBill()} className="h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground">{t('kassa.checks.billConfirmYes')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing ? <ProductQuickEdit ctx={ctx} product={catalog?.products.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} /> : null}
      {addonFor && (
        isQuickChoice(addonFor.addonGroups)
          ? <QuickChoiceDialog product={addonFor} countFor={(ids) => draftCountWith(store.check(check.id) ?? check, addonFor.id, ids)}
              onAdd={(ids) => addOne(addonFor, ids)} onClose={() => setAddonFor(null)} />
          : <AddonDialog product={addonFor} onClose={() => setAddonFor(null)} onConfirm={(ids) => { addOne(addonFor, ids); setAddonFor(null); }} />
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

/** KASSA-UX-3 — één verplichte keuze (bv. 25/33/50 cl): elke tik = één erbij, het venster blijft open. */
function QuickChoiceDialog({ product, countFor, onAdd, onClose }: { product: CatalogProduct; countFor: (ids: string[]) => number; onAdd: (ids: string[]) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const g = product.addonGroups[0];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{product.name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('kassa.checks.quickChoiceHint')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {g.options.map((o) => {
            const n = countFor([o.id]);
            return (
              <button key={o.id} type="button" onClick={() => onAdd([o.id])}
                className={cn('relative flex min-h-20 flex-col items-center justify-center rounded-lg border-2 p-2 text-center active:scale-[0.97]', n > 0 ? 'border-primary bg-primary/5' : 'border-border')}>
                <span className="text-base font-semibold">{o.name}</span>
                <span className="text-xs text-muted-foreground">{formatEuro(product.price_cents + o.price_cents, i18n.language)}</span>
                {n > 0 && <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{n}</span>}
              </button>
            );
          })}
        </div>
        <DialogFooter><button type="button" onClick={onClose} className="h-12 w-full rounded-md bg-primary font-semibold text-primary-foreground sm:w-auto sm:px-6">{t('kassa.checks.done')}</button></DialogFooter>
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

/** KASSA-0.6 — producttegel: tikken = +1; lang drukken = op/terug of prijs aanpassen.
 *  KASSA-UX-1: badge met het aantal in deze ronde, "−" om er één af te halen, kleurstreep per categorie. */
function ProductTile({ p, count, flash, tone, onTap, onLong, onMinus, label, editHint, minusLabel }: {
  p: CatalogProduct; count: number; flash: boolean; tone: string; onTap: () => void; onLong: () => void; onMinus: () => void; label: string; editHint: string; minusLabel: string;
}) {
  const lp = useLongPress(onLong, true);
  // Een uitverkocht product blijft aanraakbaar (lang drukken om het terug te zetten).
  return (
    <div className="relative">
      <button type="button" aria-disabled={p.sold_out || undefined} title={editHint}
        onClick={() => { if (lp.consumeClick()) return; if (p.sold_out) { toast.info(`${p.name}: ${label}`); return; } onTap(); }} {...lp.handlers}
        className={cn('flex min-h-[4.5rem] w-full select-none flex-col justify-between rounded-lg border border-l-4 bg-card p-2 text-left transition-colors [-webkit-touch-callout:none] active:scale-[0.97] sm:min-h-20',
          tone, p.sold_out && 'opacity-40', count > 0 && 'bg-primary/5 ring-1 ring-primary/40', flash && 'bg-primary/15')}>
        <span className={cn('line-clamp-2 text-sm font-semibold leading-tight', count > 0 && 'pr-6')}>{p.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{label}</span>
      </button>
      {count > 0 && (
        <>
          <span aria-hidden className="pointer-events-none absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{count}</span>
          <button type="button" aria-label={minusLabel} onClick={onMinus}
            className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-br-lg rounded-tl-lg border-l border-t bg-background/90 active:bg-muted">
            <Minus className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
