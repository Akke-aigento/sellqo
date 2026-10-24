// KAART-1 — producten in één keer toevoegen: een lijst plakken of de startkaart aanvinken.
// Beide eindigen in hetzelfde voorbeeld (KAART-2: de foto-import ook): naam, prijs, categorie,
// dubbels uitgevinkt, en per nieuwe categorie de btw-soort. Pas na "Toevoegen" wordt iets
// aangemaakt.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { findDuplicates, nameKey, parseKaartText, priceFromInput, priceToInput } from './parseKaart';
import { STARTER_GROUPS, guessVatKind, type VatKind } from './starterKaart';
import { kaartErrorKey, useKaartMutations, useKaartVat, type KaartCategory, type KaartProduct } from './useKaart';

export type ImportSource = 'paste' | 'starter' | 'photo';

export interface PreviewRow {
  key: string;
  include: boolean;
  name: string;
  /** Zoals in het invoerveld ("4,50"). */
  price: string;
  /** Naam van de categorie (bestaand of nieuw); leeg = zonder categorie. */
  category: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ImportSource;
  categories: KaartCategory[];
  products: KaartProduct[];
  /** Foto-import (KAART-2): meteen naar het voorbeeld met deze lijnen. */
  initialRows?: Omit<PreviewRow, 'key' | 'include'>[];
  /** Categorie voor geplakte lijnen zonder kopje (bv. de categorie waar je op klikte). */
  defaultCategoryId?: string | null;
}

const KINDS: VatKind[] = ['alcohol', 'soft', 'food'];

export function KaartImportDialog({ open, onOpenChange, source, categories, products, initialRows, defaultCategoryId }: Props) {
  const { t, i18n } = useTranslation();
  const { importLines } = useKaartMutations();
  const vat = useKaartVat();
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [text, setText] = useState('');
  const [defaultCat, setDefaultCat] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [kinds, setKinds] = useState<Record<string, VatKind>>({});

  const catByKey = useMemo(() => new Map(categories.map((c) => [nameKey(c.name), c])), [categories]);
  const starterName = (key: string) => t(`admin.kaart.starter.cat.${key}`);

  const toPreview = (lines: Omit<PreviewRow, 'key' | 'include'>[], kindHints: Record<string, VatKind> = {}) => {
    const dups = findDuplicates(lines, products.map((p) => p.name));
    setRows(lines.map((l, i) => ({ ...l, key: `${i}-${l.name}`, include: dups[i] === null })));
    const k: Record<string, VatKind> = {};
    for (const l of lines) {
      const ck = nameKey(l.category);
      if (l.category && !catByKey.has(ck) && !k[ck]) k[ck] = kindHints[ck] ?? guessVatKind(l.category);
    }
    setKinds(k);
    setStep('preview');
  };

  // Elke keer dat het venster opent: schone lei (en meteen het voorbeeld bij de foto-import).
  useEffect(() => {
    if (!open) return;
    setText('');
    setShowMore(new Set());
    const def = defaultCategoryId ? categories.find((c) => c.id === defaultCategoryId)?.name ?? '' : '';
    setDefaultCat(def);
    // Wat al op de kaart staat, vinken we niet aan.
    const have = new Set(products.map((p) => nameKey(p.name)));
    setPicked(new Set(STARTER_GROUPS.flatMap((g) => g.basic.filter((n) => !have.has(nameKey(n))).map((n) => `${g.key}|${n}`))));
    if (initialRows) toPreview(initialRows);
    else { setStep('input'); setRows([]); setKinds({}); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromPaste = () => {
    const lines = parseKaartText(text).map((l) => ({
      name: l.name,
      price: l.price ? priceToInput(l.price, i18n.language) : '',
      category: l.category ?? defaultCat,
    }));
    if (!lines.length) { toast.error(t('admin.kaart.import.nothing')); return; }
    toPreview(lines);
  };

  const fromStarter = () => {
    const lines: Omit<PreviewRow, 'key' | 'include'>[] = [];
    const hints: Record<string, VatKind> = {};
    for (const g of STARTER_GROUPS) {
      for (const n of [...g.basic, ...(g.more ?? [])]) {
        if (picked.has(`${g.key}|${n}`)) lines.push({ name: n, price: '', category: starterName(g.key) });
      }
      hints[nameKey(starterName(g.key))] = g.vat;
    }
    if (!lines.length) { toast.error(t('admin.kaart.import.nothing')); return; }
    toPreview(lines, hints);
  };

  const included = rows.filter((r) => r.include);
  const invalid = included.filter((r) => !r.name.trim() || priceFromInput(r.price) === null);
  const newCats = Object.keys(kinds).filter((k) => included.some((r) => nameKey(r.category) === k));
  const dupFlags = useMemo(() => findDuplicates(rows, products.map((p) => p.name)), [rows, products]);

  const patch = (key: string, p: Partial<PreviewRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const setCategory = (key: string, category: string) => {
    patch(key, { category });
    const ck = nameKey(category);
    if (category.trim() && !catByKey.has(ck)) setKinds((k) => (k[ck] ? k : { ...k, [ck]: guessVatKind(category) }));
  };

  const commit = () => {
    if (!included.length || invalid.length) return;
    importLines.mutate({
      lines: included.map((r) => {
        const existing = r.category.trim() ? catByKey.get(nameKey(r.category)) : undefined;
        // Een verborgen categorie gaat langs kaart_ensure_category, die zet haar terug zichtbaar.
        return { name: r.name.trim(), price: priceFromInput(r.price)!, category: r.category.trim() || null, categoryId: existing && existing.is_active !== false ? existing.id : null };
      }),
      vatFor: (name) => vat.forKind(kinds[nameKey(name)] ?? guessVatKind(name)),
    }, {
      onSuccess: (out) => { toast.success(t('admin.kaart.import.done', { count: out.length })); onOpenChange(false); },
      onError: (e) => {
        const created = (e as { created?: number }).created ?? 0;
        toast.error(t(kaartErrorKey(e)), { description: created ? t('admin.kaart.import.partial', { count: created }) : undefined });
        // Een deel staat er al: venster dicht, anders maakt opnieuw klikken dubbels.
        if (created) onOpenChange(false);
      },
    });
  };

  const title = source === 'starter' ? t('admin.kaart.starter.title') : source === 'photo' ? t('admin.kaart.photo.previewTitle') : t('admin.kaart.import.title');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!importLines.isPending) onOpenChange(o); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {step === 'preview' ? t('admin.kaart.import.previewIntro') : source === 'starter' ? t('admin.kaart.starter.intro') : t('admin.kaart.import.intro')}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && source === 'paste' ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} autoFocus
              placeholder={t('admin.kaart.import.placeholder')} aria-label={t('admin.kaart.import.title')} className="font-mono text-sm" />
            <div className="space-y-1.5">
              <Label htmlFor="kaart-default-cat">{t('admin.kaart.import.defaultCategory')}</Label>
              <Input id="kaart-default-cat" list="kaart-cats" value={defaultCat} onChange={(e) => setDefaultCat(e.target.value)} placeholder={t('admin.kaart.noCategory')} />
              <p className="text-xs text-muted-foreground">{t('admin.kaart.import.defaultCategoryHint')}</p>
            </div>
          </div>
        ) : null}

        {step === 'input' && source === 'starter' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {STARTER_GROUPS.map((g) => {
              const all = [...g.basic, ...(showMore.has(g.key) ? g.more ?? [] : [])];
              const count = [...g.basic, ...(g.more ?? [])].filter((n) => picked.has(`${g.key}|${n}`)).length;
              return (
                <section key={g.key} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{starterName(g.key)} <span className="text-sm font-normal text-muted-foreground">({count})</span></h3>
                    <span className="text-xs text-muted-foreground">{t(`admin.kaart.vatKind.${g.vat}`)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {all.map((n) => {
                      const id = `${g.key}|${n}`;
                      const on = picked.has(id);
                      const exists = products.some((p) => nameKey(p.name) === nameKey(n));
                      return (
                        <button key={id} type="button" aria-pressed={on}
                          onClick={() => setPicked((s) => { const x = new Set(s); if (on) x.delete(id); else x.add(id); return x; })}
                          className={cn('min-h-9 rounded-full border px-3 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background', exists && 'line-through opacity-60')}
                          title={exists ? t('admin.kaart.import.exists') : undefined}>
                          {n}
                        </button>
                      );
                    })}
                    {g.more?.length ? (
                      <button type="button" onClick={() => setShowMore((s) => { const x = new Set(s); if (x.has(g.key)) x.delete(g.key); else x.add(g.key); return x; })}
                        className="min-h-9 rounded-full px-3 text-sm text-primary hover:underline">
                        {showMore.has(g.key) ? t('admin.kaart.starter.less') : t('admin.kaart.starter.more', { count: g.more.length })}
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
            <p className="text-xs text-muted-foreground">{t('admin.kaart.starter.vatNote')}</p>
          </div>
        ) : null}

        {step === 'preview' ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {newCats.length ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="text-sm font-medium">{t('admin.kaart.import.newCategories')}</p>
                {newCats.map((k) => {
                  const label = included.find((r) => nameKey(r.category) === k)?.category ?? k;
                  return (
                    <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-28 font-medium">{label}</span>
                      <div className="flex flex-wrap gap-1">
                        {KINDS.map((kind) => (
                          <button key={kind} type="button" aria-pressed={kinds[k] === kind} onClick={() => setKinds((s) => ({ ...s, [k]: kind }))}
                            className={cn('min-h-8 rounded-full border px-2.5 text-xs', kinds[k] === kind ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}>
                            {t(`admin.kaart.vatKind.${kind}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">{t('admin.kaart.starter.vatNote')}</p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              {rows.map((r, i) => {
                const bad = r.include && (!r.name.trim() || priceFromInput(r.price) === null);
                return (
                  <div key={r.key} className={cn('flex flex-wrap items-center gap-2 rounded-md border p-2', !r.include && 'opacity-60')}>
                    <Checkbox checked={r.include} onCheckedChange={(v) => patch(r.key, { include: v === true })} aria-label={t('admin.kaart.import.include', { name: r.name })} />
                    <Input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} maxLength={150} aria-label={t('admin.kaart.col.name')} className="h-9 min-w-0 flex-1 basis-40" />
                    <Input value={r.price} onChange={(e) => patch(r.key, { price: e.target.value })} inputMode="decimal" placeholder="0,00" aria-label={t('admin.kaart.col.price')}
                      className={cn('h-9 w-24 text-right tabular-nums', bad && priceFromInput(r.price) === null && 'border-destructive')} />
                    <Input value={r.category} onChange={(e) => setCategory(r.key, e.target.value)} list="kaart-cats" placeholder={t('admin.kaart.noCategory')} aria-label={t('admin.kaart.col.category')} className="h-9 w-full sm:w-44" />
                    {dupFlags[i] ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />{t(dupFlags[i] === 'existing' ? 'admin.kaart.import.exists' : 'admin.kaart.import.repeat')}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <datalist id="kaart-cats">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'preview' && !initialRows ? <Button variant="outline" onClick={() => setStep('input')} disabled={importLines.isPending}>{t('admin.kaart.import.back')}</Button> : null}
          {step === 'input' ? (
            <Button onClick={source === 'starter' ? fromStarter : fromPaste}>{t('admin.kaart.import.toPreview')}</Button>
          ) : (
            <Button onClick={commit} disabled={!included.length || invalid.length > 0 || importLines.isPending}>
              {importLines.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {invalid.length ? t('admin.kaart.import.fixPrices', { count: invalid.length }) : t('admin.kaart.import.add', { count: included.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
