// KAART-1 — de horeca-kaart: alle producten per categorie op één scherm, zoals een spreadsheet.
// Een product is een naam en een prijs; btw komt van de categorie (instellen via het tandwiel).
// Dezelfde producten als in Producten, de kassa, het QR-menu en de webshop: geen kopie.
import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, CircleSlash, ClipboardPaste, FolderPlus, GripVertical, ImageIcon, Loader2, Plus, Search, Settings2, Sparkles, X } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useCan, useScopedRoles } from '@/hooks/useCan';
import { isSoldOutNow, useSoldOutToday } from '@/components/admin/storefront/food/useSoldOutToday';
import { nameKey, parseKaartText, priceFromInput, priceToInput } from './parseKaart';
import { KaartImportDialog, type ImportSource, type PreviewRow } from './KaartImportDialog';
import { KaartPhotoButton } from './KaartPhotoButton';
import { kaartErrorKey, kaartKey, useKaart, useKaartMutations, useKaartVat, type BulkChange, type KaartCategory, type KaartProduct } from './useKaart';
import { KaartProductSheet } from './KaartProductSheet';
import { useTenant } from '@/hooks/useTenant';

const NONE = '__none__';

export function KaartManager() {
  const { t } = useTranslation();
  const canEdit = useCan('write', 'products');
  // Aanmaken, bulk, prijs en btw: enkel beheerder of medewerker (zoals de kaart_*-functies en
  // guard_product_commercial_fields). Marketing mag naam, kanalen en zichtbaarheid aanpassen.
  const roles = useScopedRoles();
  const canFull = canEdit && !!roles?.some((r) => r === 'platform_admin' || r === 'tenant_admin' || r === 'staff');
  const { data, isLoading } = useKaart();
  const m = useKaartMutations();
  const vat = useKaartVat();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | { source: ImportSource; rows?: Omit<PreviewRow, 'key' | 'include'>[] }>(null);
  const [newCat, setNewCat] = useState('');
  // KAART-3: het product dat open staat in het paneel.
  const [openId, setOpenId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const categories = useMemo(() => data?.categories ?? [], [data]);
  const products = useMemo(() => data?.products ?? [], [data]);
  const term = nameKey(q);
  const visible = useMemo(() => (term ? products.filter((p) => nameKey(p.name).includes(term)) : products), [products, term]);

  const sections = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const list: { cat: KaartCategory | null; items: KaartProduct[] }[] = categories
      .map((c) => ({ cat: c, items: visible.filter((p) => p.category_id === c.id) }))
      // Lege, verborgen categorieën tonen we niet; lege actieve wel (om in toe te voegen).
      .filter((s) => s.items.length > 0 || (!term && s.cat.is_active !== false));
    const loose = visible.filter((p) => !p.category_id || !known.has(p.category_id));
    if (loose.length) list.push({ cat: null, items: loose });
    return list;
  }, [categories, visible, term]);

  const fail = (e: unknown) => toast.error(t(kaartErrorKey(e)), { description: (e as { message?: string })?.message?.slice(0, 160) });
  const toggleSel = (ids: string[], on: boolean) => setSelected((s) => { const x = new Set(s); ids.forEach((id) => (on ? x.add(id) : x.delete(id))); return x; });

  // Slepen: meteen tonen (optimistisch), dan bewaren. Bij een fout ververst de lijst vanzelf.
  type KaartData = { categories: KaartCategory[]; products: KaartProduct[] };
  const reorderProducts = (catId: string | null, ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const inCat = products.filter((p) => (p.category_id ?? null) === catId);
    const from = inCat.findIndex((p) => p.id === active.id);
    const to = inCat.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const ordered = arrayMove(inCat, from, to);
    const pos = new Map(ordered.map((p, i) => [p.id, i]));
    qc.setQueryData<KaartData>(kaartKey(currentTenant?.id), (d) => d && ({
      ...d, products: d.products.map((p) => (pos.has(p.id) ? { ...p, menu_position: pos.get(p.id)! } : p)).sort((a, b) =>
        (a.menu_position ?? 1e9) - (b.menu_position ?? 1e9) || a.name.localeCompare(b.name, 'nl')),
    }));
    m.reorder.mutate({ kind: 'products', ids: ordered.map((p) => p.id) }, { onError: fail });
  };
  const reorderCategories = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    const ordered = arrayMove(categories, from, to);
    qc.setQueryData<KaartData>(kaartKey(currentTenant?.id), (d) => d && ({ ...d, categories: ordered.map((c, i) => ({ ...c, sort_order: i })) }));
    m.reorder.mutate({ kind: 'categories', ids: ordered.map((c) => c.id) }, { onError: fail });
  };
  const canDrag = canFull && !term;

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    m.createCategory.mutate({ name }, { onSuccess: () => { setNewCat(''); toast.success(t('admin.kaart.categoryAdded', { name })); }, onError: fail });
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" aria-label={t('common.loading')} />;

  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.kaart.search')} aria-label={t('admin.kaart.search')} className="pl-9" />
        </label>
        {canFull ? (
          <div className="flex flex-wrap gap-2">
            <KaartPhotoButton onRows={(rows) => setDialog({ source: 'photo', rows })} />
            <Button variant="outline" onClick={() => setDialog({ source: 'paste' })}><ClipboardPaste className="mr-2 h-4 w-4" />{t('admin.kaart.paste')}</Button>
            <Button variant="outline" onClick={() => setDialog({ source: 'starter' })}><Sparkles className="mr-2 h-4 w-4" />{t('admin.kaart.starter.button')}</Button>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.kaart.summary', { count: products.length, active: activeCount })} · {t('admin.kaart.sharedNote')}</p>

      {!products.length && !term ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="font-medium">{t('admin.kaart.empty.title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('admin.kaart.empty.body')}</p>
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderCategories}>
        <SortableContext items={sections.filter((s) => s.cat).map((s) => s.cat!.id)} strategy={verticalListSortingStrategy}>
          {sections.map(({ cat, items }) => {
            const key = cat?.id ?? NONE;
            const open = !collapsed.has(key) || !!term;
            const ids = items.map((p) => p.id);
            const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
            const header = (handle: React.ReactNode) => (
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
                {handle}
                <button type="button" onClick={() => setCollapsed((s) => { const x = new Set(s); if (x.has(key)) x.delete(key); else x.add(key); return x; })}
                  aria-expanded={open} className="flex min-h-9 items-center gap-1 font-semibold">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {cat ? cat.name : t('admin.kaart.noCategory')}
                  <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                </button>
                {cat?.is_active === false ? <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{t('admin.kaart.hiddenCategory')}</span> : null}
                <span className="ml-auto flex items-center gap-2">
                  {cat ? <VatBadge cat={cat} rateOf={vat.rateOf} /> : null}
                  {canFull && ids.length ? (
                    <Checkbox checked={allSel} onCheckedChange={(v) => toggleSel(ids, v === true)} aria-label={t('admin.kaart.selectAll', { name: cat?.name ?? t('admin.kaart.noCategory') })} />
                  ) : null}
                  {canFull && cat ? <CategorySettings cat={cat} productIds={products.filter((p) => p.category_id === cat.id).map((p) => p.id)} onError={fail} /> : null}
                </span>
              </div>
            );
            const body = open ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(ev) => reorderProducts(cat?.id ?? null, ev)}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <div className="divide-y">
                    {items.map((p) => (
                      <ProductRow key={p.id} p={p} canEdit={canEdit} canPrice={canFull} canDrag={canDrag} selected={selected.has(p.id)}
                        onSelect={(on) => toggleSel([p.id], on)} onOpen={() => setOpenId(p.id)} onError={fail} />
                    ))}
                    {canFull && !term ? <QuickAdd categoryId={cat?.id ?? null} onError={fail} /> : null}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null;
            return cat
              ? <SortableSection key={key} id={cat.id} canDrag={canDrag} label={t('admin.kaart.dragCategory', { name: cat.name })} header={header} body={body} />
              : <section key={key} className="rounded-lg border">{header(null)}{body}</section>;
          })}
        </SortableContext>
      </DndContext>

      {canFull && !term ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
            placeholder={t('admin.kaart.newCategoryPlaceholder')} aria-label={t('admin.kaart.newCategory')} maxLength={80} className="max-w-xs" />
          <Button variant="outline" onClick={addCategory} disabled={!newCat.trim() || m.createCategory.isPending}><FolderPlus className="mr-2 h-4 w-4" />{t('admin.kaart.newCategory')}</Button>
        </div>
      ) : null}

      {canFull && selected.size > 0 ? (
        <BulkBar ids={[...selected]} categories={categories} products={products} onDone={() => setSelected(new Set())} onError={fail} />
      ) : null}

      {openId ? (
        <KaartProductSheet product={products.find((p) => p.id === openId) ?? null} categories={categories} canEdit={canEdit} canFull={canFull}
          onClose={() => setOpenId(null)} onOpen={setOpenId} onError={fail} />
      ) : null}

      {dialog ? (
        <KaartImportDialog open onOpenChange={(o) => { if (!o) setDialog(null); }} source={dialog.source} initialRows={dialog.rows}
          categories={categories} products={products} />
      ) : null}
    </div>
  );
}

function VatBadge({ cat, rateOf }: { cat: KaartCategory; rateOf: (id: string | null) => number | null }) {
  const { t } = useTranslation();
  const here = rateOf(cat.default_vat_rate_id);
  const away = rateOf(cat.default_takeaway_vat_rate_id);
  if (here === null && away === null) return <span className="text-xs text-muted-foreground">{t('admin.kaart.vatNone')}</span>;
  return <span className="text-xs tabular-nums text-muted-foreground">{t('admin.kaart.vatShort', { here: here ?? '–', away: away ?? here ?? '–' })}</span>;
}

/** Tandwiel per categorie: naam, standaard-btw, en die btw op de bestaande producten zetten. */
function CategorySettings({ cat, productIds, onError }: { cat: KaartCategory; productIds: string[]; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const m = useKaartMutations();
  const vat = useKaartVat();
  const [name, setName] = useState(cat.name);
  // Eén optie per percentage, maar het tarief dat de categorie al heeft, staat er altijd in.
  const chosen = new Set([cat.default_vat_rate_id, cat.default_takeaway_vat_rate_id].filter(Boolean));
  const opts = vat.rates
    .filter((r, i, a) => chosen.has(r.id) || (!a.some((x) => chosen.has(x.id) && Number(x.rate) === Number(r.rate)) && a.findIndex((x) => Number(x.rate) === Number(r.rate)) === i))
    .sort((a, b) => Number(b.rate) - Number(a.rate));
  const select = (field: 'default_vat_rate_id' | 'default_takeaway_vat_rate_id', value: string) =>
    m.updateCategory.mutate({ id: cat.id, patch: { [field]: value || null } }, { onError });
  const apply = () => m.bulk.mutate({ ids: productIds, change: { apply_category_vat: true } }, {
    onSuccess: (n) => toast.success(t('admin.kaart.vatApplied', { count: n })), onError,
  });
  return (
    <Popover onOpenChange={(o) => { if (o) setName(cat.name); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('admin.kaart.categorySettings', { name: cat.name })}><Settings2 className="h-4 w-4" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cat-name-${cat.id}`}>{t('admin.kaart.categoryName')}</Label>
          <div className="flex gap-2">
            <Input id={`cat-name-${cat.id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <Button variant="outline" disabled={!name.trim() || name.trim() === cat.name} onClick={() => m.updateCategory.mutate({ id: cat.id, patch: { name: name.trim() } }, { onError })}>{t('common.save')}</Button>
          </div>
        </div>
        {(['default_vat_rate_id', 'default_takeaway_vat_rate_id'] as const).map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={`${field}-${cat.id}`}>{t(field === 'default_vat_rate_id' ? 'admin.kaart.vatHere' : 'admin.kaart.vatAway')}</Label>
            <select id={`${field}-${cat.id}`} value={cat[field] ?? ''} onChange={(e) => select(field, e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm">
              <option value="">{field === 'default_vat_rate_id' ? t('admin.kaart.vatShopDefault') : t('admin.kaart.vatSameAsHere')}</option>
              {opts.map((r) => <option key={r.id} value={r.id}>{Number(r.rate)} %</option>)}
            </select>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t('admin.kaart.vatHint')}</p>
        <Button variant="secondary" className="w-full" disabled={!productIds.length || (!cat.default_vat_rate_id && !cat.default_takeaway_vat_rate_id) || m.bulk.isPending} onClick={apply}>
          {t('admin.kaart.vatApply', { count: productIds.length })}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Een categorie die je kan verslepen (greep links in de kop). */
function SortableSection({ id, canDrag, label, header, body }: { id: string; canDrag: boolean; label: string; header: (handle: React.ReactNode) => React.ReactNode; body: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !canDrag });
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-lg border bg-background', isDragging && 'z-20 shadow-lg')}>
      {header(canDrag ? (
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={label}
          className="flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null)}
      {body}
    </section>
  );
}

/**
 * Eén product: greep, aan/uit, naam (tik = alles in het paneel), prijs in de lijn, "op".
 * Kanalen, foto, extra's en de rest staan in het paneel: één tik en je bent er.
 */
function ProductRow({ p, canEdit, canPrice, canDrag, selected, onSelect, onOpen, onError }: {
  p: KaartProduct; canEdit: boolean; canPrice: boolean; canDrag: boolean; selected: boolean;
  onSelect: (on: boolean) => void; onOpen: () => void; onError: (e: unknown) => void;
}) {
  const { t, i18n } = useTranslation();
  const m = useKaartMutations();
  const soldOut = useSoldOutToday();
  const qc = useQueryClient();
  const out = isSoldOutNow(p.sold_out_until);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: !canDrag });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-x-1.5 bg-background px-2 py-1.5 sm:gap-x-3 sm:px-3 sm:py-2', !p.is_active && 'bg-muted/30', selected && 'bg-primary/5', isDragging && 'relative z-10 shadow-lg')}>
      {canDrag ? (
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={t('admin.kaart.dragProduct', { name: p.name })}
          className="flex h-9 w-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      {canPrice ? <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={t('admin.kaart.select', { name: p.name })} /> : null}
      <Switch checked={p.is_active} disabled={!canEdit} onCheckedChange={(v) => m.updateProduct.mutate({ id: p.id, patch: { is_active: v } }, { onError })}
        aria-label={p.is_active ? t('admin.kaart.hide', { name: p.name }) : t('admin.kaart.show', { name: p.name })} />
      <button type="button" onClick={onOpen} aria-label={t('admin.kaart.openProduct', { name: p.name })}
        className={cn('flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left hover:bg-muted/60', !p.is_active && 'text-muted-foreground')}>
        {p.featured_image ? <img src={p.featured_image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />}
        <span className="truncate font-medium">{p.name}</span>
        <ChevronRight className="ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      </button>
      <InlineText value={priceToInput(p.price, i18n.language)} disabled={!canPrice} onInvalid={() => toast.error(t('admin.kaart.badPrice'))} label={t('admin.kaart.col.price')} inputMode="decimal" className="w-[4.5rem] shrink-0 text-right tabular-nums sm:w-24"
        validate={(v) => priceFromInput(v) !== null}
        onCommit={(v) => { const n = priceFromInput(v); if (n !== null && Number(n) !== p.price) m.updateProduct.mutate({ id: p.id, patch: { price: Number(n) } }, { onError }); }} />
      {/* Op een gsm enkel het icoon (alles op één lijn); rood = op. */}
      <Button type="button" size="sm" variant={out ? 'destructive' : 'outline'} disabled={!canEdit || soldOut.isPending} className="h-9 w-9 justify-center px-0 sm:w-40 sm:px-3"
        onClick={() => soldOut.mutate({ productId: p.id, soldOut: !out }, { onSettled: () => qc.invalidateQueries({ queryKey: ['kaart'] }) })} aria-pressed={out}
        aria-label={out ? t('admin.storefront.food.sold_out_undo') : t('admin.storefront.food.sold_out_action')}>
        <CircleSlash className="h-4 w-4 sm:mr-1 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">{out ? t('admin.kaart.soldOut') : t('admin.kaart.markSoldOut')}</span>
      </Button>
    </div>
  );
}

/** Tekstveld dat pas bewaart bij Enter of wegklikken; Escape zet terug. */
function InlineText({ value, onCommit, disabled, label, className, inputMode, validate, onInvalid }: {
  value: string; onCommit: (v: string) => void; disabled?: boolean; label: string; className?: string;
  inputMode?: 'decimal'; validate?: (v: string) => boolean; onInvalid?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape: blur() roept onBlur meteen op, nog met de oude draft. Deze vlag zegt "niet bewaren".
  const cancelled = useRef(false);
  const shown = draft ?? value;
  const bad = draft !== null && validate ? !validate(draft) : false;
  const commit = () => {
    if (cancelled.current) { cancelled.current = false; setDraft(null); return; }
    if (draft === null) return;
    if (bad) onInvalid?.();
    else if (draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <Input value={shown} disabled={disabled} aria-label={label} inputMode={inputMode} aria-invalid={bad || undefined}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { cancelled.current = true; setDraft(null); (e.target as HTMLInputElement).blur(); } }}
      className={cn('h-9 border-input/40 bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input', bad && 'border-destructive', className)} />
  );
}

/** Onderaan elke categorie: "Duvel 4,50" + Enter. */
function QuickAdd({ categoryId, onError }: { categoryId: string | null; onError: (e: unknown) => void }) {
  const { t, i18n } = useTranslation();
  const m = useKaartMutations();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const priceRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    let n = name.trim();
    let p = priceFromInput(price);
    // "Duvel 4,50" in het naamveld: prijs eruit halen.
    if (p === null && n) {
      const parsed = parseKaartText(n)[0];
      if (parsed?.price) { n = parsed.name; p = parsed.price; }
    }
    if (!n) return;
    if (p === null) { if (n !== name) setName(n); priceRef.current?.focus(); return; }
    m.add.mutate([{ name: n, price: p, category_id: categoryId }], {
      onSuccess: () => { setName(''); setPrice(''); nameRef.current?.focus(); },
      onError,
    });
  };
  return (
    <form className="flex flex-wrap items-center gap-2 px-3 py-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder={t('admin.kaart.quickAddPlaceholder')} aria-label={t('admin.kaart.quickAdd')} className="h-9 min-w-0 flex-1 basis-24 sm:basis-40" />
      <Input ref={priceRef} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={priceToInput(0, i18n.language)} aria-label={t('admin.kaart.col.price')} className="h-9 w-20 text-right tabular-nums sm:w-24" />
      <Button type="submit" size="sm" className="h-9" disabled={!name.trim() || m.add.isPending}>{m.add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.kaart.add')}</Button>
    </form>
  );
}

/** Selectie onderaan: prijs, categorie, aan/uit, op/terug. */
function BulkBar({ ids, categories, products, onDone, onError }: { ids: string[]; categories: KaartCategory[]; products: KaartProduct[]; onDone: () => void; onError: (e: unknown) => void }) {
  const { t } = useTranslation();
  const m = useKaartMutations();
  const qc = useQueryClient();
  const [soldBusy, setSoldBusy] = useState(false);
  const [mode, setMode] = useState<'add' | 'percent' | 'set'>('add');
  const [value, setValue] = useState('0,10');
  const run = (change: BulkChange) => m.bulk.mutate({ ids, change }, { onSuccess: (n) => { toast.success(t('admin.kaart.bulk.done', { count: n })); onDone(); }, onError });
  const priceValue = () => {
    const raw = value.trim().replace(',', '.');
    return /^-?\d{1,5}(\.\d{1,4})?$/.test(raw) ? raw : null;
  };
  // Zelfde functie als "op voor vandaag" per product (reset de volgende ochtend), één melding.
  const setAllSoldOut = async (on: boolean) => {
    const targets = products.filter((p) => ids.includes(p.id) && isSoldOutNow(p.sold_out_until) !== on);
    setSoldBusy(true);
    try {
      for (const p of targets) {
        const { error } = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ error: unknown }>)(
          'set_product_sold_out_today', { p_product_id: p.id, p_sold_out: on });
        if (error) throw error;
      }
      toast.success(t('admin.kaart.bulk.done', { count: targets.length }));
      onDone();
    } catch (e) { onError(e); } finally {
      setSoldBusy(false);
      qc.invalidateQueries({ queryKey: ['kaart'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    }
  };
  return (
    <div className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-4xl rounded-xl border bg-card p-3 shadow-2xl sm:bottom-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t('admin.kaart.bulk.selected', { count: ids.length })}</span>
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="outline">{t('admin.kaart.bulk.price')}</Button></PopoverTrigger>
          <PopoverContent className="w-72 space-y-3">
            <div className="flex gap-1">
              {(['add', 'percent', 'set'] as const).map((x) => (
                <button key={x} type="button" aria-pressed={mode === x} onClick={() => { setMode(x); setValue(x === 'add' ? '0,10' : x === 'percent' ? '5' : ''); }}
                  className={cn('h-9 flex-1 rounded-md border text-sm', mode === x && 'border-primary bg-primary text-primary-foreground')}>
                  {t(`admin.kaart.bulk.mode.${x}`)}
                </button>
              ))}
            </div>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" aria-label={t('admin.kaart.bulk.value')} aria-invalid={priceValue() === null || undefined} />
            <p className="text-xs text-muted-foreground">{t(`admin.kaart.bulk.hint.${mode}`)}</p>
            <Button className="w-full" disabled={priceValue() === null || m.bulk.isPending} onClick={() => run({ price: { mode, value: priceValue()! } })}>{t('admin.kaart.bulk.apply', { count: ids.length })}</Button>
          </PopoverContent>
        </Popover>
        <select aria-label={t('admin.kaart.bulk.move')} value="" onChange={(e) => { if (e.target.value) run({ category_id: e.target.value, apply_category_vat: true }); }}
          className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">{t('admin.kaart.bulk.move')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={m.bulk.isPending} onClick={() => run({ is_active: true })}>{t('admin.kaart.bulk.show')}</Button>
        <Button size="sm" variant="outline" disabled={m.bulk.isPending} onClick={() => run({ is_active: false })}>{t('admin.kaart.bulk.hide')}</Button>
        <Button size="sm" variant="outline" disabled={soldBusy} onClick={() => void setAllSoldOut(true)}>{t('admin.kaart.markSoldOut')}</Button>
        <Button size="sm" variant="outline" disabled={soldBusy} onClick={() => void setAllSoldOut(false)}>{t('admin.kaart.bulk.backIn')}</Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}><X className="mr-1 h-4 w-4" />{t('admin.kaart.bulk.clear')}</Button>
      </div>
    </div>
  );
}
