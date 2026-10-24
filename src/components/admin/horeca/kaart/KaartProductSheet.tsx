// KAART-3 — één product, volledig, zonder de Kaart te verlaten. Alles bewaart meteen.
// Bovenaan wat een barman het vaakst doet (prijs ±0,10, op, zichtbaar), daaronder categorie,
// foto, waar te koop, extra's, allergenen en beschrijving; btw per product onder "Meer".
// "Maat toevoegen" maakt een kopie net onder dit product (kaart_duplicate_product).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronDown, CircleSlash, ExternalLink, ImageOff, Loader2, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useImageUpload } from '@/hooks/useImageUpload';
import { CHANNELS } from '@/components/admin/storefront/food/ProductChannelsCard';
import { ProductAllergensCard } from '@/components/admin/storefront/food/ProductAllergensCard';
import { ProductAddonsCard } from '@/components/admin/storefront/food/ProductAddonsCard';
import { isSoldOutNow, useSoldOutToday } from '@/components/admin/storefront/food/useSoldOutToday';
import { priceFromInput, priceToInput } from './parseKaart';
import { useKaartMutations, useKaartVat, type KaartCategory, type KaartProduct } from './useKaart';

interface Props {
  product: KaartProduct | null;
  categories: KaartCategory[];
  canEdit: boolean;
  /** Prijs, btw, categorie en maat toevoegen: enkel beheerder of medewerker. */
  canFull: boolean;
  /** Extra's koppelen: enkel de beheerder (RLS op product_addon_groups). */
  canAddons: boolean;
  onClose: () => void;
  /** Na "Maat toevoegen": het nieuwe product openen. */
  onOpen: (id: string) => void;
  onError: (e: unknown) => void;
}

const cents = (n: number) => Math.round(n * 100);

export function KaartProductSheet({ product, categories, canEdit, canFull, canAddons, onClose, onOpen, onError }: Props) {
  const { t, i18n } = useTranslation();
  const m = useKaartMutations();
  const vat = useKaartVat();
  const soldOut = useSoldOutToday();
  const qc = useQueryClient();
  const { uploadImage, uploading } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [more, setMore] = useState(false);
  const [extras, setExtras] = useState(false);
  const [size, setSize] = useState<null | { name: string; price: string }>(null);

  // Velden vullen bij een ander product; een verversing mag het typen niet wissen.
  const pid = product?.id;
  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setPrice(priceToInput(product.price, i18n.language));
    setDesc(product.short_description ?? '');
    setSize(null);
    setMore(false);
    setExtras(false);
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  // Prijs wel volgen als hij elders wijzigt (±0,10, bulk) en het veld niet gefocust is.
  const priceFocused = useRef(false);
  // Snel na elkaar ±0,10: tel verder vanaf de laatst gevraagde prijs, niet vanaf wat de server
  // al teruggaf. De updates lopen na elkaar (scope in useKaartMutations).
  const target = useRef<number | null>(null);
  useEffect(() => { target.current = null; }, [pid]);
  useEffect(() => {
    if (!product) return;
    if (target.current !== null && Math.round(product.price * 100) === target.current) target.current = null;
    if (!priceFocused.current && target.current === null) setPrice(priceToInput(product.price, i18n.language));
  }, [product?.price]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) return null;
  const p = product;
  // Sluiten (kruisje, Escape, naast het paneel tikken) bewaart eerst wat nog getypt staat:
  // daar komt geen blur meer.
  const close = () => {
    const v = name.trim().slice(0, 150);
    const patch: Parameters<typeof m.updateProduct.mutate>[0]['patch'] = {};
    if (canEdit && v && v !== p.name) patch.name = v;
    const d = desc.trim();
    if (canEdit && d !== (p.short_description ?? '')) patch.short_description = d || null;
    const n = priceFromInput(price);
    if (canFull && n !== null && Number(n) !== p.price) patch.price = Number(n);
    if (Object.keys(patch).length) m.updateProduct.mutate({ id: p.id, patch }, { onError });
    // Allergenen bewaart hun eigen kaart; de teller in de Kaart ververst hier.
    void qc.invalidateQueries({ queryKey: ['kaart'] });
    onClose();
  };
  const out = isSoldOutNow(p.sold_out_until);
  const channels = p.channels ?? [...CHANNELS];
  const save = (patch: Parameters<typeof m.updateProduct.mutate>[0]['patch']) => m.updateProduct.mutate({ id: p.id, patch }, { onError });

  const commitName = () => {
    const v = name.trim().slice(0, 150);
    if (v && v !== p.name) save({ name: v }); else setName(p.name);
  };
  const commitPrice = (raw = price) => {
    target.current = null;
    const n = priceFromInput(raw);
    if (n === null) { toast.error(t('admin.kaart.badPrice')); setPrice(priceToInput(p.price, i18n.language)); return; }
    if (Number(n) !== p.price) save({ price: Number(n) });
  };
  const nudge = (delta: number) => {
    const nextCents = Math.max(0, (target.current ?? cents(p.price)) + delta);
    target.current = nextCents;
    setPrice(priceToInput(nextCents / 100, i18n.language));
    save({ price: nextCents / 100 });
  };
  const setChannel = (c: string, on: boolean) => {
    const next = on ? [...new Set([...channels, c])] : channels.filter((x) => x !== c);
    if (!next.length) { toast.error(t('admin.kaart.oneChannel')); return; }
    save({ channels: next });
  };
  const moveTo = (categoryId: string) => {
    if (categoryId === p.category_id) return;
    m.bulk.mutate({ ids: [p.id], change: { category_id: categoryId, apply_category_vat: true } }, { onError });
  };
  const onPhoto = async (file: File) => {
    const url = await uploadImage(file, 'product-images', undefined, { folder: 'products', title: p.name });
    if (!url) return;
    save({ featured_image: url, images: [url, ...(p.images ?? []).filter((x) => x !== url)] });
  };
  const addSize = () => {
    if (!size) return;
    const n = priceFromInput(size.price);
    if (!size.name.trim() || n === null) { toast.error(t('admin.kaart.badPrice')); return; }
    m.duplicate.mutate({ id: p.id, name: size.name.trim(), price: n }, {
      // Eerst de lijst ophalen, dan het nieuwe product openen (anders knippert het paneel).
      onSuccess: async (r) => {
        toast.success(t('admin.kaart.sheet.sizeAdded', { name: size.name.trim() }));
        setSize(null);
        await qc.refetchQueries({ queryKey: ['kaart'] });
        // Enkel openen als het nieuwe product er al is (anders blijft het huidige open).
        const found = qc.getQueriesData<{ products: KaartProduct[] }>({ queryKey: ['kaart'] }).some(([, d]) => d?.products.some((x) => x.id === r.id));
        if (found) onOpen(r.id);
      },
      onError,
    });
  };
  const rates = vat.rates.filter((r, i, a) => r.id === p.vat_rate_id || r.id === p.takeaway_vat_rate_id
    || (!a.some((x) => (x.id === p.vat_rate_id || x.id === p.takeaway_vat_rate_id) && Number(x.rate) === Number(r.rate)) && a.findIndex((x) => Number(x.rate) === Number(r.rate)) === i))
    .sort((a, b) => Number(b.rate) - Number(a.rate));

  return (
    <Sheet open onOpenChange={(o) => { if (!o) close(); }}>
      {/* Eigen, grote sluitknop (de standaard is te klein voor een toogvinger en zat achter de kop). */}
      <SheetContent side="right" onOpenAutoFocus={(e) => e.preventDefault()} className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg [&>button.absolute]:hidden">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b bg-background p-4 text-left">
          <SheetTitle className="sr-only">{p.name}</SheetTitle>
          <SheetDescription className="sr-only">{t('admin.kaart.sheet.intro')}</SheetDescription>
          <div className="flex items-center gap-2">
            <Input value={name} disabled={!canEdit} maxLength={150} aria-label={t('admin.kaart.col.name')} onChange={(e) => setName(e.target.value)}
              onBlur={commitName} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="h-12 min-w-0 flex-1 text-xl font-semibold" />
            <Button type="button" variant="ghost" size="icon" className="h-12 w-12 shrink-0" onClick={close} aria-label={t('admin.kaart.sheet.close')}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" disabled={!canFull} onClick={() => nudge(-10)} aria-label={t('admin.kaart.sheet.minus')}>
              <Minus className="h-5 w-5" />
            </Button>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input value={price} disabled={!canFull} inputMode="decimal" aria-label={t('admin.kaart.col.price')} onChange={(e) => setPrice(e.target.value)}
                onFocus={() => { priceFocused.current = true; }} onBlur={() => { priceFocused.current = false; commitPrice(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="h-12 pl-7 text-right text-xl font-semibold tabular-nums" />
            </div>
            <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" disabled={!canFull} onClick={() => nudge(10)} aria-label={t('admin.kaart.sheet.plus')}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={out ? 'destructive' : 'outline'} className="h-12" disabled={!canEdit || soldOut.isPending} aria-pressed={out}
              onClick={() => soldOut.mutate({ productId: p.id, soldOut: !out }, { onSettled: () => qc.invalidateQueries({ queryKey: ['kaart'] }) })}>
              <CircleSlash className="mr-2 h-4 w-4" />{out ? t('admin.kaart.bulk.backIn') : t('admin.kaart.markSoldOut')}
            </Button>
            <label className={cn('flex h-12 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium', !canEdit && 'cursor-not-allowed opacity-60')}>
              {p.is_active ? t('admin.kaart.sheet.onMenu') : t('admin.kaart.sheet.offMenu')}
              <Switch checked={p.is_active} disabled={!canEdit} onCheckedChange={(v) => save({ is_active: v })} />
            </label>
          </div>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {canFull ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t('admin.kaart.col.category')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {categories.filter((c) => c.is_active !== false || c.id === p.category_id).map((c) => (
                  <button key={c.id} type="button" aria-pressed={c.id === p.category_id} onClick={() => moveTo(c.id)} disabled={m.bulk.isPending}
                    className={cn('min-h-10 rounded-full border px-3 text-sm', c.id === p.category_id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}>
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('admin.kaart.sheet.categoryHint')}</p>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('admin.kaart.sheet.photo')}</h3>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {p.featured_image ? <img src={p.featured_image} alt={p.name} className="h-full w-full object-cover" /> : <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-11" disabled={!canEdit || uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  {p.featured_image ? t('admin.kaart.sheet.photoReplace') : t('admin.kaart.sheet.photoAdd')}
                </Button>
                {p.featured_image ? (
                  <Button type="button" variant="ghost" className="h-11" disabled={!canEdit} onClick={() => save({ featured_image: null, images: (p.images ?? []).filter((x) => x !== p.featured_image) })}>
                    <X className="mr-1 h-4 w-4" />{t('admin.kaart.sheet.photoRemove')}
                  </Button>
                ) : null}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onPhoto(f); }} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('admin.kaart.channels')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => {
                const on = channels.includes(c);
                return (
                  <button key={c} type="button" disabled={!canEdit} aria-pressed={on} onClick={() => setChannel(c, !on)}
                    className={cn('min-h-11 rounded-md border px-3 text-left text-sm', on ? 'border-primary/60 bg-primary/10 font-medium' : 'text-muted-foreground')}>
                    {t(`admin.kaart.channel.${c}`)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor={`kaart-desc-${p.id}`} className="text-sm font-semibold">{t('admin.kaart.sheet.description')}</Label>
            <Textarea id={`kaart-desc-${p.id}`} value={desc} rows={2} maxLength={300} disabled={!canEdit} placeholder={t('admin.kaart.sheet.descriptionPlaceholder')}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => { const v = desc.trim(); if (v !== (p.short_description ?? '')) save({ short_description: v || null }); }} />
          </section>

          {/* Extra's en allergenen: zelden nodig aan de toog, dus ingeklapt. Enkel voor wie mag
              bewerken; extra's koppelen enkel de beheerder (RLS op product_addon_groups). */}
          {canEdit ? <section className="rounded-lg border">
            <button type="button" onClick={() => { if (extras) void qc.invalidateQueries({ queryKey: ['kaart'] }); setExtras((v) => !v); }} aria-expanded={extras} className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-semibold">
              <span>{t(canAddons ? 'admin.kaart.sheet.extras' : 'admin.kaart.sheet.allergens')}{(p.allergens?.length ?? 0) > 0 ? <span className="ml-2 font-normal text-muted-foreground">{t('admin.kaart.sheet.allergenCount', { count: p.allergens!.length })}</span> : null}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', extras && 'rotate-180')} />
            </button>
            {extras ? (
              <div className="space-y-4 border-t p-3">
                {canAddons ? <ProductAddonsCard productId={p.id} categoryIds={p.category_id ? [p.category_id] : []} /> : null}
                <ProductAllergensCard productId={p.id} />
              </div>
            ) : null}
          </section> : null}

          {canFull ? (
            <section className="space-y-3 rounded-lg border p-3">
              {size ? (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); addSize(); }}>
                  <p className="text-sm font-semibold">{t('admin.kaart.sheet.sizeTitle')}</p>
                  <div className="flex gap-2">
                    <Input value={size.name} autoFocus maxLength={150} aria-label={t('admin.kaart.col.name')} onChange={(e) => setSize({ ...size, name: e.target.value })} className="h-11 min-w-0 flex-1" />
                    <Input value={size.price} inputMode="decimal" aria-label={t('admin.kaart.col.price')} placeholder={priceToInput(0, i18n.language)} onChange={(e) => setSize({ ...size, price: e.target.value })} className="h-11 w-24 text-right tabular-nums" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setSize(null)}>{t('common.cancel')}</Button>
                    <Button type="submit" className="flex-1" disabled={m.duplicate.isPending}>{m.duplicate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.kaart.add')}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('admin.kaart.sheet.sizeHint')}</p>
                </form>
              ) : (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setSize({ name: `${p.name} `, price: '' })}>
                  <Plus className="mr-2 h-4 w-4" />{t('admin.kaart.sheet.addSize')}
                </Button>
              )}
            </section>
          ) : null}

          {canFull ? (
            <section className="rounded-lg border">
              <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex min-h-11 w-full items-center justify-between px-3 text-sm font-semibold">
                {t('admin.kaart.sheet.more')}<ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} />
              </button>
              {more ? (
                <div className="space-y-3 border-t p-3">
                  {(['vat_rate_id', 'takeaway_vat_rate_id'] as const).map((field) => (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={`${field}-${p.id}`}>{t(field === 'vat_rate_id' ? 'admin.kaart.vatHere' : 'admin.kaart.vatAway')}</Label>
                      <select id={`${field}-${p.id}`} value={p[field] ?? ''} onChange={(e) => save({ [field]: e.target.value || null })}
                        className="h-11 w-full rounded-md border bg-background px-2 text-sm">
                        <option value="">{field === 'vat_rate_id' ? t('admin.kaart.vatShopDefault') : t('admin.kaart.vatSameAsHere')}</option>
                        {rates.map((r) => <option key={r.id} value={r.id}>{Number(r.rate)} %</option>)}
                      </select>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{t('admin.kaart.sheet.vatHint')}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          <Link to={`/admin/products/${p.id}/edit`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />{t('admin.kaart.sheet.allSettings')}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
