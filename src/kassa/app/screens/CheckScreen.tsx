// TAFEL-1 — één rekening: lijnen links, kaart rechts (op een gsm als tabbladen).
// Tik op een product = +1 (meteen zichtbaar). Tik op een lijn = aantal, opmerking, annuleren
// met reden, korting/van het huis, verplaatsen. Onderaan: Rekening (voorrekening), Verstuur
// (ronde naar keuken/bar) en Afrekenen (TAFEL-2). Apart afrekenen = deelrekening.
// KASSA-UX-1: zelfde product nog eens tikken telt op dezelfde lijn op; de tegel toont het aantal
// in deze ronde met een "−"; op een gsm toont een balk onderaan aantal en totaal en wisselt
// tussen kaart en rekening; de kaart opent op Populair (of de eerste categorie), niet op alles.
// KASSA-RECHTEN-1: korting, van het huis en een verstuurde lijn annuleren = meteen voor eigenaar/verantwoordelijke,
// anders eerst hun PIN (ApprovalDialog; de server controleert).
// KASSA-UX-6: lege rekening schrappen met bevestiging, opmerking bewaart bij sluiten, vegen = weg met
// "Ongedaan maken", "Herhaal vorige ronde" in het ⋯-menu, een toogverkoop op naam of naar een tafel.
// GANGEN-1: met gangen aan (instelling van de zaak) krijgt elke aangetikte lijn een gang (per categorie, of de
// gekozen gang bovenaan); latere gangen wachten als ontwerp tot "Gang … vrijgeven" (zie horeca/courses.ts).
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChefHat, ChevronDown, ChevronUp, Flame, Loader2, Minus, MoreHorizontal, Plus, Search, Send, Receipt, Soup, ShieldCheck, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import { cn } from '@/lib/utils';
import { checkTotalCents, isCounter, lineTotalCents, type Check, type CheckLine } from '../horeca/types';
import { kitchenOn, rememberKitchen, rememberService, type CounterService } from '../horeca/counter';
import { roundLines } from '../horeca/fiscalLines';
import { discountLine, fireCourse, moveCheck, moveLines, requestBill, sendRound, voidLine, type ActionCtx, type ActionOutcome } from '../horeca/actions';
import { COURSES, courseFor, goesToBar, isHeld, nextHeldCourse, sendableIds, type Course } from '../horeca/courses';
import { useKassaCourseSettings } from '../horeca/paySettings';
import { usePrepStations } from '@/hooks/usePrepStations';
import { approvalFor, needsApproval, type ApprovalAction, type ApprovalBind } from '../horeca/approvals';
import { lastRoundLines } from '../horeca/kassaUx';
import { ApprovalDialog } from './ApprovalDialog';
import { useCatalog, usePopularLines, type CatalogProduct } from '../horeca/useCatalog';
import { categoryDot, categoryTone, draftCountWith, draftCounts, isQuickChoice, itemCount, lineEditKind, planMinus, planMinusWith, planTap, popularIds, qtyLocked } from '../horeca/quickTap';
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
  // KASSA-UX-4: verstuurde lijn via − of vegen → het venster opent meteen op "waarom annuleren".
  const [lineSheetVoid, setLineSheetVoid] = useState(false);
  const [confirmUnbill, setConfirmUnbill] = useState(false);
  const [addonFor, setAddonFor] = useState<CatalogProduct | null>(null);
  const [moving, setMoving] = useState<null | { lines: CheckLine[] | 'all' }>(initialMove ? { lines: 'all' } : null);
  const [confirmBill, setConfirmBill] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // KASSA-RECHTEN-1: wachtend op het akkoord van een eigenaar/verantwoordelijke.
  const [approval, setApproval] = useState<null | { action: ApprovalAction; lineId: string | null; bind: ApprovalBind; what: string; run: (approvalId: string) => Promise<void> }>(null);
  const [kitchen, setKitchen] = useState(kitchenOn);
  // KASSA-0.6: lang drukken op een product = op/terug of prijs, goedgekeurd met de PIN van
  // een eigenaar of verantwoordelijke (de server controleert).
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  // GANGEN-1: instelling van de zaak, posten (drank = bar = geen gang) en de gekozen gang (null = automatisch).
  const courseSettings = useKassaCourseSettings(store.tenantId);
  const { data: prep } = usePrepStations();
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const euro = (c: number) => formatEuro(c, i18n.language);

  const popular = useMemo(() => {
    const all = catalog?.products ?? [];
    return popularIds(soldLines ?? [], new Set(all.map((p) => p.id)));
  }, [catalog, soldLines]);
  // Standaard: Populair als er genoeg verkoopgegevens zijn, anders de eerste categorie.
  const activeCat = cat ?? (popular.length ? POPULAR : catalog?.categories[0]?.id ?? ALL);
  const catIndex = useMemo(() => new Map((catalog?.categories ?? []).map((c, i) => [c.id, i])), [catalog]);
  const specials = useMemo(() => (catalog?.products ?? []).filter((p) => p.daily_special), [catalog]);
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
  // GANGEN-1: enkel aan tafel (niet aan de toog), en enkel als de zaak gangen aanzette.
  const coursesOn = courseSettings.enabled && !isCounter(check);
  const nextHeld = coursesOn ? nextHeldCourse(check, true) : null;
  const heldCount = coursesOn ? check.lines.filter((l) => isHeld(check, l, true)).length : 0;
  const courseName = (c: number) => t(`admin.courses.c${c}`, { defaultValue: t('admin.courses.cN', { n: c }) });
  /** Gang voor een nieuwe lijn van dit product (undefined = gangen uit: niets meegeven). */
  const courseOf = (p: CatalogProduct): number | null | undefined => (coursesOn ? courseFor(courseSettings, p, activeCourse, goesToBar(prep, p)) : undefined);
  const drafts = (coursesOn ? sendableIds(check, true).size : roundLines(check).length) + check.lines.filter((l) => l.pending && l.state === 'draft').length;
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

  const addProduct = (p: CatalogProduct, addonIds: string[] = [], course?: number | null) => {
    const addons = p.addonGroups.flatMap((g) => g.options).filter((o) => addonIds.includes(o.id)).map((o) => ({ option_id: o.id, name: o.name, price_cents: o.price_cents }));
    // KASSA-0.6: aan de toog bij meenemen het meeneemtarief, zoals de server (kassa_product_vat_rate).
    store.hint(p.id, { name: p.name, unit_price_cents: p.price_cents, vat_label: counter && service === 'takeaway' ? p.vat_label_takeaway : p.vat_label, addons });
    store.enqueue({ id: crypto.randomUUID(), kind: 'add_line', check_id: check.id, line_id: crypto.randomUUID(), product_id: p.id, qty: 1, addon_ids: addonIds,
      ...(course != null ? { course } : {}), staff_id: ctx.staffId });
  };

  /** Eén erbij: optellen op een lijn met precies hetzelfde product en dezelfde extra's, anders een nieuwe lijn. */
  const addOne = (p: CatalogProduct, addonIds: string[] = [], course: number | null | undefined = courseOf(p)) => {
    // Trillen waar het toestel dat kan (Android); de oplichting is er altijd.
    try { navigator.vibrate?.(12); } catch { /* geen trilfunctie */ }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(p.id);
    flashTimer.current = setTimeout(() => setFlash(null), 180);
    const fresh = store.check(check.id) ?? check;
    const plan = planTap(fresh, p.id, addonIds, course);
    if (plan.kind === 'qty') store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: plan.lineId, qty: plan.qty, staff_id: ctx.staffId });
    else addProduct(p, addonIds, course);
  };
  const tapProduct = (p: CatalogProduct) => {
    if (p.sold_out) return;
    if (p.addonGroups.length) { setAddonFor(p); return; }
    addOne(p);
  };
  // KASSA-UX-4: + en − rechtstreeks op een lijn in de rekening, en naar links vegen = weg.
  const productOf = (l: CheckLine) => (l.product_id ? catalog?.products.find((x) => x.id === l.product_id) : undefined);
  const openLine = (l: CheckLine, voidFirst = false) => { setLineSheetVoid(voidFirst); setLineSheet(l); };
  const linePlus = (l: CheckLine) => {
    const p = productOf(l);
    // GANGEN-1: + op een lijn blijft in de gang van die lijn.
    if (p && !p.sold_out) addOne(p, l.addons.map((a) => a.option_id), coursesOn ? l.course ?? null : undefined);
  };
  const lineMinus = (l: CheckLine) => {
    const kind = lineEditKind(l);
    // Review 1: het aantal van een lijn met korting ligt vast (knop staat uit; de server weigert het ook).
    if (kind === 'draft' && !qtyLocked(l)) store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: l.id, qty: l.qty - 1, staff_id: ctx.staffId });
    else if (kind === 'sent') openLine(l, true);
  };
  const lineRemove = (l: CheckLine) => {
    const kind = lineEditKind(l);
    if (kind === 'draft') {
      store.enqueue({ id: crypto.randomUUID(), kind: 'void_line', check_id: check.id, line_id: l.id, new_line_id: crypto.randomUUID(), reason: 'mistake', qty: l.qty, staff_id: ctx.staffId });
      // KASSA-UX-6: vegen is snel en dus ook snel per ongeluk. Ongedaan maken = dezelfde lijn opnieuw
      // aantikken (zelfde product, extra's, aantal en opmerking). Een lijn met korting kwam zonder korting
      // terug; daarom dan geen knop maar enkel de melding.
      const p = productOf(l);
      const undo = !!p && !p.sold_out && l.price_changes.length === 0 && !l.corrects_line_id;
      toast(t('kassa.ux6.removed', { qty: l.qty, name: l.name }), undo && p ? {
        duration: 6000,
        action: { label: t('kassa.ux6.undo'), onClick: () => restoreLine(l, p) },
      } : { duration: 3000 });
    } else if (kind === 'sent') openLine(l, true);
  };
  const restoreLine = (l: CheckLine, p: CatalogProduct) => {
    store.hint(p.id, { name: p.name, unit_price_cents: l.unit_price_cents, vat_label: l.vat_label, addons: l.addons });
    store.enqueue({ id: crypto.randomUUID(), kind: 'add_line', check_id: check.id, line_id: crypto.randomUUID(), product_id: p.id, qty: l.qty,
      addon_ids: l.addons.map((a) => a.option_id), ...(l.note ? { note: l.note } : {}), ...(l.course != null ? { course: l.course } : {}), staff_id: ctx.staffId });
  };
  // KASSA-UX-6: "Herhaal vorige ronde" — de lijnen van de laatst verstuurde ronde opnieuw als ontwerp
  // (wat nog openstaat; geannuleerde stuks niet). Producten die op zijn of niet meer bestaan, vallen weg.
  const repeat = lastRoundLines(check);
  const repeatRound = () => {
    let added = 0;
    let skipped = 0;
    for (const l of repeat) {
      const p = productOf(l);
      const qty = l.open_qty > 0 ? l.open_qty : 0;
      if (!qty) continue;
      if (!p || p.sold_out) { skipped += 1; continue; }
      restoreLine({ ...l, qty }, p);
      added += qty;
    }
    if (added) toast.success(t('kassa.ux6.repeat', { count: added }));
    if (skipped) toast.info(t('kassa.ux6.repeatSkipped', { count: skipped }));
    if (!added && !skipped) toast.info(t('kassa.ux6.repeatNothing'));
  };
  /** KASSA-RECHTEN-1: meteen (eigenaar/verantwoordelijke), of eerst het akkoord met hun PIN. */
  const guarded = (action: ApprovalAction | null, lineId: string | null, bind: ApprovalBind, what: string, run: (approvalId?: string) => Promise<void>) => {
    if (action && needsApproval(ctx, action)) setApproval({ action, lineId, bind, what, run });
    else void run();
  };
  const minusProduct = (p: CatalogProduct) => {
    const m = planMinus(check, p.id);
    if (m) store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: m.lineId, qty: m.qty, staff_id: ctx.staffId });
  };

  // GANGEN-1: gang vrijgeven = stand op de server + die lijnen als gewone ronde (P/ORDER).
  const doFire = async (course: number) => {
    setBusy('send');
    const o = await fireCourse(ctx, check.id, course);
    setBusy(null);
    report(o, t('admin.courses.fired', { name: courseName(course) }));
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
  // KASSA-UX-6: een rekening met lijnen schrappen vraagt eerst een bevestiging (een lege meteen).
  const doDelete = async () => {
    setConfirmDelete(false);
    const r = await store.applyNow({ id: crypto.randomUUID(), kind: 'void_check', check_id: check.id, staff_id: ctx.staffId }).catch(() => null);
    if (r?.ok) onBack(); else toast.error(t('kassa.checks.error.server', { detail: r?.error ?? '' }));
  };
  const doUnbill = async () => {
    setConfirmUnbill(false);
    const r = await store.applyNow({ id: crypto.randomUUID(), kind: 'cancel_bill', check_id: check.id, staff_id: ctx.staffId }).catch(() => null);
    if (r?.ok) toast.success(t('kassa.tableActions.unbillDone')); else toast.error(t('kassa.checks.error.server', { detail: r?.error ?? '' }));
  };

  const lineRow = (l: CheckLine) => {
    const kind = locked ? null : lineEditKind(l);
    const p = productOf(l);
    return (
      <LineRow key={l.id} line={l} canEdit={kind} canPlus={!!kind && !!p && !p.sold_out} total={euro(lineTotalCents(l))}
        course={coursesOn && l.course != null && l.qty > 0 ? { label: courseName(l.course), held: isHeld(check, l, true), heldLabel: t('admin.courses.waiting') } : null}
        reason={l.neg_reason ? t(`kassa.checks.reason.${l.neg_reason}`) : null} priceChanges={l.price_changes.map((pc) => ({ id: pc.grouping_id, text: `${pc.name} ${euro(pc.amount_cents)}` }))}
        labels={{ plus: t('kassa.checks.more1'), minus: t('kassa.checks.less'), remove: kind === 'sent' ? t('kassa.checks.cancelLine') : t('kassa.checks.remove') }}
        onOpen={() => openLine(l)} onPlus={() => linePlus(l)} onMinus={() => lineMinus(l)} onRemove={() => lineRemove(l)} />
    );
  };

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
      {/* HORECA-NU-2b — de dagschotel(s) van vandaag bovenaan, met één tik aan te slaan (gewone prijs). */}
      {!searching && specials.length > 0 ? (
        <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]" data-testid="kassa-specials">
          {specials.map((p) => (
            <button key={p.id} type="button" onClick={() => tapProduct(p)} disabled={p.sold_out}
              className="flex h-14 shrink-0 items-center gap-2 rounded-lg border-2 border-amber-500 bg-amber-50 px-3 text-left text-amber-950 active:scale-[0.98] disabled:opacity-50 dark:bg-amber-950 dark:text-amber-50">
              <Soup className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[11px] font-bold uppercase tracking-wide">{t('kassa.now.special.badge')}</span>
                <span className="max-w-[12rem] truncate font-semibold">{p.name}</span>
              </span>
              <span className="text-sm font-bold tabular-nums">{p.sold_out ? t('kassa.checks.soldOut') : euro(p.price_cents)}</span>
              {(counts.get(p.id) ?? 0) > 0 ? <span className="rounded-full bg-amber-600 px-1.5 text-xs font-bold text-white">{counts.get(p.id)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
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
            {!counter && check.bill_requested_at && !locked && (
              <DropdownMenuItem onClick={() => setConfirmUnbill(true)}>{t('kassa.tableActions.unbill')}</DropdownMenuItem>
            )}
            {!counter && <DropdownMenuItem disabled={locked || !sentAny && !drafts} onClick={() => void openSplit()}>{t('kassa.pay.split')}</DropdownMenuItem>}
            {!counter && <DropdownMenuItem disabled={locked || !!check.split_of} onClick={() => setMoving({ lines: 'all' })}>{t('kassa.checks.moveCheck')}</DropdownMenuItem>}
            {/* KASSA-UX-6: dezelfde lijnen van de vorige ronde nog eens (enkel aan tafel, daar zijn rondes). */}
            {!counter && repeat.length > 0 && <DropdownMenuItem disabled={locked} onClick={repeatRound}>{t('kassa.ux6.repeatRound')}</DropdownMenuItem>}
            {/* KASSA-UX-6: een toogverkoop op naam (tab) of naar een tafel zetten — zelfde verplaatsvenster. */}
            {counter && <DropdownMenuItem disabled={locked || !visible.length} onClick={() => setMoving({ lines: 'all' })}>{t('kassa.ux6.counterToTab')}</DropdownMenuItem>}
            {!sentAny && !locked && (
              <DropdownMenuItem onClick={() => (visible.length ? setConfirmDelete(true) : void doDelete())}>{t(visible.length ? 'kassa.ux6.deleteCheck' : 'kassa.checks.deleteCheck')}</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {coursesOn ? (
        // GANGEN-1: gekozen gang voor wat je nu aantikt, en de volgende wachtende gang vrijgeven.
        <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('admin.courses.active')}>
            {([null, ...COURSES] as (Course | null)[]).map((c) => (
              <button key={c ?? 'auto'} type="button" aria-pressed={activeCourse === c} onClick={() => setActiveCourse(c)}
                className={cn('h-11 rounded-full border px-3 text-sm font-semibold', activeCourse === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}>
                {c ? courseName(c) : t('admin.courses.auto')}
              </button>
            ))}
          </div>
          {nextHeld != null ? (
            <button type="button" onClick={() => void doFire(nextHeld)} disabled={locked || !!busy}
              className="ml-auto flex h-11 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-sm font-bold text-white disabled:opacity-40">
              <ChefHat className="h-4 w-4" aria-hidden />{t('admin.courses.fire', { name: courseName(nextHeld), count: heldCount })}
            </button>
          ) : null}
        </div>
      ) : null}

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
        <LineDialog key={`${lineSheet.id}-${lineSheetVoid}`} line={check.lines.find((l) => l.id === lineSheet.id) ?? lineSheet} busy={busy === 'discount'} canMove={!counter} voidFirst={lineSheetVoid} onClose={() => setLineSheet(null)}
          onQty={(qty) => store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: lineSheet.id, qty, staff_id: ctx.staffId })}
          onNote={(note) => store.enqueue({ id: crypto.randomUUID(), kind: 'set_note', check_id: check.id, line_id: lineSheet.id, note, staff_id: ctx.staffId })}
          courses={coursesOn ? [{ value: null, label: t('admin.courses.none') }, ...COURSES.map((c) => ({ value: c as number | null, label: courseName(c) }))] : undefined}
          onCourse={(course, note) => store.enqueue({ id: crypto.randomUUID(), kind: 'set_note', check_id: check.id, line_id: lineSheet.id, note, course, staff_id: ctx.staffId })}
          approvalNeeded={{ discount: needsApproval(ctx, 'discount'), void: needsApproval(ctx, approvalFor('void', lineSheet)) }}
          onVoid={(reason, qty) => {
            const l = lineSheet;
            guarded(approvalFor('void', l), l.id, { qty }, `${qty}× ${l.name}`, async (approvalId) => {
              const o = await voidLine(ctx, check.id, l.id, reason, qty, approvalId);
              if (report(o)) { setApproval(null); setLineSheet(null); }
            });
          }}
          onDiscount={(d) => {
            const l = lineSheet;
            guarded('discount', l.id, { percent: d.percent }, `${d.name} · ${l.qty}× ${l.name}`, async (approvalId) => {
              setBusy('discount');
              const ok = report(await discountLine(ctx, check.id, l.id, d, approvalId));
              setBusy(null);
              if (ok) { setApproval(null); setLineSheet(null); }
            });
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

      <Dialog open={confirmUnbill} onOpenChange={setConfirmUnbill}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('kassa.tableActions.unbill')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('kassa.tableActions.unbillConfirm', { title })}</p>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmUnbill(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={() => void doUnbill()} className="h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground">{t('kassa.tableActions.unbill')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('kassa.ux6.deleteTitle', { title })}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('kassa.ux6.deleteText', { count: itemCount(check), amount: euro(checkTotalCents(check)) })}</p>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="h-11 rounded-md border px-4">{t('kassa.common.cancel')}</button>
            <button type="button" onClick={() => void doDelete()} className="h-11 rounded-md bg-destructive px-4 font-semibold text-destructive-foreground">{t('kassa.ux6.deleteCheck')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {approval && (
        <ApprovalDialog ctx={ctx} action={approval.action} checkId={check.id} lineId={approval.lineId} bind={approval.bind} what={approval.what}
          onApproved={(id) => approval.run(id)} onClose={() => setApproval(null)} />
      )}

      {editing ? <ProductQuickEdit ctx={ctx} product={catalog?.products.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} /> : null}
      {addonFor && (
        isQuickChoice(addonFor.addonGroups)
          ? <QuickChoiceDialog product={addonFor} countFor={(ids) => draftCountWith(store.check(check.id) ?? check, addonFor.id, ids, courseOf(addonFor))}
              onAdd={(ids) => addOne(addonFor, ids)} onClose={() => setAddonFor(null)}
              onMinus={(ids) => {
                const m = planMinusWith(store.check(check.id) ?? check, addonFor.id, ids, courseOf(addonFor));
                if (m) store.enqueue({ id: crypto.randomUUID(), kind: 'change_qty', check_id: check.id, line_id: m.lineId, qty: m.qty, staff_id: ctx.staffId });
              }} />
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
  /** KASSA-RECHTEN-1: deze knoppen vragen eerst de PIN van een verantwoordelijke (schildje). */
  approvalNeeded?: { discount: boolean; void: boolean };
  onVoid: (reason: string, qty: number) => void; onDiscount: (d: { percent?: number; name: string }) => void; onMove: () => void;
  /** KASSA-UX-4: meteen de vraag "waarom annuleren" (verstuurde lijn via − of vegen). */
  voidFirst?: boolean;
  /** GANGEN-1: gang van een ontwerp-lijn wijzigen (enkel met gangen aan). */
  courses?: { value: number | null; label: string }[];
  onCourse?: (course: number | null, note: string) => void;
}) {
  const { t } = useTranslation();
  const l = p.line;
  const [note, setNote] = useState(l.note ?? '');
  const [voidQty, setVoidQty] = useState(l.state === 'draft' ? l.qty : p.voidFirst ? 1 : Math.max(1, l.open_qty));
  const [askReason, setAskReason] = useState(!!p.voidFirst && l.state === 'sent');
  const editable = l.state === 'draft';
  const canAct = l.qty > 0 && (editable || l.open_qty > 0);
  // KASSA-UX-6: een getypte opmerking gaat nooit stil verloren — sluiten zonder "Opslaan" bewaart ze ook.
  const close = () => {
    if (editable && canAct && note.trim() !== (l.note ?? '').trim()) p.onNote(note);
    p.onClose();
  };
  const shield = <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />;
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{l.qty}× {l.name}</DialogTitle></DialogHeader>
        {!canAct ? <p className="text-sm text-muted-foreground">{t('kassa.checks.lineLocked')}</p> : (
          <div className="space-y-4">
            {editable && (
              <div className="flex items-center justify-center gap-4">
                {/* Review 1: met korting ligt het aantal vast (weghalen en opnieuw tikken kan wel). */}
                <button type="button" aria-label={t('kassa.checks.less')} disabled={qtyLocked(l)} onClick={() => p.onQty(Math.max(0, l.qty - 1))} className="h-14 w-14 rounded-full border text-2xl font-bold disabled:opacity-30">−</button>
                <span className="w-10 text-center text-2xl font-bold tabular-nums">{l.qty}</span>
                <button type="button" aria-label={t('kassa.checks.more1')} disabled={qtyLocked(l)} onClick={() => p.onQty(Math.min(999, l.qty + 1))} className="h-14 w-14 rounded-full border text-2xl font-bold disabled:opacity-30">+</button>
              </div>
            )}
            {editable && qtyLocked(l) ? <p className="text-center text-xs text-muted-foreground">{t('kassa.ux6.qtyLocked')}</p> : null}
            {editable && p.courses && p.onCourse && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('admin.courses.lineCourse')}>
                {p.courses.map((c) => (
                  <button key={c.value ?? 'none'} type="button" aria-pressed={(l.course ?? null) === c.value} onClick={() => p.onCourse?.(c.value, note)}
                    className={cn('h-11 rounded-full border px-3 text-sm font-semibold', (l.course ?? null) === c.value ? 'border-primary bg-primary text-primary-foreground' : '')}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {editable && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); p.onNote(note); p.onClose(); }}>
                <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('kassa.checks.notePlaceholder')} aria-label={t('kassa.checks.note')} className="h-11 flex-1 rounded-md border bg-background px-3" />
                <button type="submit" className="h-11 rounded-md border px-3 text-sm font-semibold">{t('kassa.common.save')}</button>
              </form>
            )}
            {!askReason && <div className="space-y-2">
              <p className="text-sm font-semibold">{t('kassa.checks.discount')}</p>
              <div className="flex flex-wrap gap-2">
                {DISCOUNTS.map((d) => (
                  <button key={d} type="button" disabled={p.busy || l.price_changes.length > 0} onClick={() => p.onDiscount({ percent: d, name: t('kassa.checks.discountName', { n: d }) })}
                    className="flex h-11 items-center gap-1 rounded-md border px-3 text-sm font-semibold disabled:opacity-40">{p.approvalNeeded?.discount && shield}−{d} %</button>
                ))}
                <button type="button" disabled={p.busy || l.price_changes.length > 0} onClick={() => p.onDiscount({ percent: 100, name: t('kassa.checks.onTheHouse') })}
                  className="flex h-11 items-center gap-1 rounded-md border px-3 text-sm font-semibold disabled:opacity-40">{p.approvalNeeded?.discount && shield}{t('kassa.checks.onTheHouse')}</button>
              </div>
              {p.approvalNeeded?.discount ? <p className="text-xs text-muted-foreground">{t('kassa.approval.hint')}</p> : null}
            </div>}
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
                {p.approvalNeeded?.void ? <p className="flex items-center gap-1 text-xs text-muted-foreground">{shield}{t('kassa.approval.hint')}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  {VOID_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => p.onVoid(r, voidQty)} className="h-11 rounded-md border text-sm">{t(`kassa.checks.voidReason.${r}`)}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter><button type="button" onClick={close} className="h-11 rounded-md border px-4">{t('kassa.common.close')}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** KASSA-UX-3 — één verplichte keuze (bv. 25/33/50 cl): elke tik = één erbij, het venster blijft open. */
function QuickChoiceDialog({ product, countFor, onAdd, onMinus, onClose }: {
  product: CatalogProduct; countFor: (ids: string[]) => number; onAdd: (ids: string[]) => void; onMinus: (ids: string[]) => void; onClose: () => void;
}) {
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
            // KASSA-UX-4: zelfde "−" rechtsonder als op de producttegels.
            return (
              <div key={o.id} className="relative">
                <button type="button" onClick={() => onAdd([o.id])}
                  className={cn('relative flex min-h-20 w-full flex-col items-center justify-center rounded-lg border-2 p-2 text-center active:scale-[0.97]', n > 0 ? 'border-primary bg-primary/5' : 'border-border')}>
                  <span className="text-base font-semibold">{o.name}</span>
                  <span className="text-xs text-muted-foreground">{formatEuro(product.price_cents + o.price_cents, i18n.language)}</span>
                  {n > 0 && <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{n}</span>}
                </button>
                {n > 0 && (
                  <button type="button" aria-label={t('kassa.checks.minusOne', { name: `${product.name} ${o.name}` })} onClick={() => onMinus([o.id])}
                    className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-br-lg rounded-tl-lg border-l-2 border-t-2 border-primary bg-background/90 active:bg-muted">
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
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
  // Een toogverkoop is nooit een doel (de server weigert het).
  const others = p.checks.filter((c) => c.id !== p.check.id && !isCounter(c) && (!c.table_id || c.split_of));
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

/**
 * KASSA-UX-4 — één lijn in de rekening: tik op de naam = details (zoals voorheen), + en − meteen,
 * naar links vegen = weg. Ontwerp-lijnen verdwijnen meteen; een verstuurde lijn opent de vraag
 * "waarom annuleren" (fiscale correctie, nooit stil wijzigen).
 */
const SWIPE_AT = 80;
function LineRow({ line: l, canEdit, canPlus, total, reason, priceChanges, labels, onOpen, onPlus, onMinus, onRemove, course }: {
  line: CheckLine; canEdit: 'draft' | 'sent' | null; canPlus: boolean; total: string; reason: string | null;
  /** GANGEN-1: gang van de lijn; held = wacht op vrijgave. */
  course?: { label: string; held: boolean; heldLabel: string } | null;
  priceChanges: { id: number; text: string }[]; labels: { plus: string; minus: string; remove: string };
  onOpen: () => void; onPlus: () => void; onMinus: () => void; onRemove: () => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; swiping: boolean } | null>(null);
  const moved = useRef(false);
  const onDown = (e: RPointerEvent) => {
    if (!canEdit) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false };
    moved.current = false;
  };
  const onMove = (e: RPointerEvent) => {
    const s0 = start.current;
    if (!s0 || s0.id !== e.pointerId) return;
    const ddx = e.clientX - s0.x;
    const ddy = e.clientY - s0.y;
    if (!s0.swiping) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { start.current = null; return; } // verticaal scrollen
      if (ddx < -10) { s0.swiping = true; moved.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
    }
    if (s0.swiping) setDx(Math.max(-140, Math.min(0, ddx)));
  };
  const onUp = () => {
    const s0 = start.current;
    start.current = null;
    if (s0?.swiping && dx <= -SWIPE_AT) onRemove();
    setDx(0);
  };
  return (
    <li className="relative overflow-hidden rounded-md">
      {dx < 0 && (
        <div aria-hidden className={cn('absolute inset-0 flex items-center justify-end gap-2 px-4 text-sm font-semibold text-destructive-foreground', dx <= -SWIPE_AT ? 'bg-destructive' : 'bg-destructive/70')}>
          <Trash2 className="h-5 w-5" />{labels.remove}
        </div>
      )}
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className={cn('relative flex items-stretch rounded-md border bg-background', dx === 0 && 'transition-transform',
          l.state === 'draft' && 'border-primary/60 shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.05)]', l.qty < 0 && 'text-destructive')}>
        <button type="button" onClick={() => { if (moved.current) { moved.current = false; return; } onOpen(); }}
          className={cn('flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left', l.pending && 'opacity-70')}>
          <span className="w-8 shrink-0 font-bold">{l.qty}×</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{l.name}</span>
            {course ? (
              <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold', course.held ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' : 'bg-muted text-muted-foreground')}>
                {course.label}{course.held ? ` · ${course.heldLabel}` : ''}
              </span>
            ) : null}
            {l.addons.length ? <span className="block truncate text-xs text-muted-foreground">+ {l.addons.map((a) => a.name).join(', ')}</span> : null}
            {l.note ? <span className="block truncate text-xs italic text-muted-foreground">“{l.note}”</span> : null}
            {priceChanges.map((p) => <span key={p.id} className="block text-xs text-emerald-700 dark:text-emerald-400">{p.text}</span>)}
            {reason ? <span className="block text-xs">{reason}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums">{total}</span>
        </button>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1 pr-1.5">
            <button type="button" aria-label={`${labels.minus}: ${l.name}`} onClick={onMinus} disabled={canEdit === 'draft' && qtyLocked(l)}
              className="flex h-11 w-11 items-center justify-center rounded-full border active:bg-muted disabled:opacity-30"><Minus className="h-4 w-4" /></button>
            <button type="button" aria-label={`${labels.plus}: ${l.name}`} onClick={onPlus} disabled={!canPlus}
              className="flex h-11 w-11 items-center justify-center rounded-full border active:bg-muted disabled:opacity-30"><Plus className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </li>
  );
}
