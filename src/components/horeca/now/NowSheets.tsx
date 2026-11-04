// HORECA-NU-1/2 — de twee lijsten achter een tegel van het Nu-paneel in beheer:
//  - Uitverkocht vandaag: zoeken en per product één tik "op" / "terug" (useSoldOutToday, zoals de Kaart;
//    vervangt de kaart "Op voor vandaag" van Vandaag).
//  - Dagschotel: een product van de kaart aanduiden, of snel een nieuw gerecht maken (zoals "Snel toevoegen"
//    op de Kaart: kaart_add_products), en "Geen dagschotel vandaag". Prijs = de gewone productprijs.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { byMenuOrder, kaartErrorKey, useKaartMutations, type KaartCategory, type KaartProduct } from '@/components/admin/horeca/kaart/useKaart';
import { isSoldOutNow, useSoldOutToday } from '@/components/admin/storefront/food/useSoldOutToday';
import { priceFromInput } from '@/components/admin/horeca/kaart/parseKaart';
import { useNowSpecials } from './useNowData';

const norm = (s: string) => s.toLocaleLowerCase('nl').normalize('NFD').replace(/[̀-ͯ]/g, '');

function SearchField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className="h-11 pl-9" />
    </label>
  );
}

// ------------------------------------------------------------------ uitverkocht vandaag

export function SoldOutSheet({ open, onClose, products }: { open: boolean; onClose: () => void; products: KaartProduct[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const soldOut = useSoldOutToday();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const term = norm(q.trim());
    return products
      .filter((p) => p.is_active && (!term || norm(p.name).includes(term)))
      // Wat al op is eerst (om terug te zetten), dan de volgorde van de Kaart.
      .sort((a, b) => Number(isSoldOutNow(b.sold_out_until)) - Number(isSoldOutNow(a.sold_out_until)) || byMenuOrder(a, b));
  }, [products, q]);

  const toggle = (p: KaartProduct) => soldOut.mutate(
    { productId: p.id, soldOut: !isSoldOutNow(p.sold_out_until) },
    { onSuccess: () => qc.invalidateQueries({ queryKey: ['kaart', currentTenant?.id] }) },
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setQ(''); } }}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('admin.now.soldout.title')}</SheetTitle>
          <SheetDescription>{t('admin.now.soldout.help')}</SheetDescription>
        </SheetHeader>
        <SearchField value={q} onChange={setQ} label={t('admin.now.search')} />
        <ul className="-mx-2 flex-1 overflow-y-auto px-2" data-testid="now-soldout-list">
          {list.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">{t('admin.now.no_results')}</li> : null}
          {list.map((p) => {
            const out = isSoldOutNow(p.sold_out_until);
            return (
              <li key={p.id} className="flex min-h-12 items-center gap-3 border-b last:border-0">
                <span className={cn('min-w-0 flex-1 truncate text-[15px] font-semibold', out && 'text-muted-foreground line-through')}>{p.name}</span>
                <Button type="button" size="sm" variant="outline" aria-pressed={out} disabled={soldOut.isPending} onClick={() => toggle(p)}
                  className={cn('h-11 shrink-0 rounded-full px-4', out && 'border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200')}>
                  {out ? t('admin.cockpit.menu.back_on') : t('admin.cockpit.menu.mark_out')}
                </Button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------------ dagschotel

export function SpecialSheet({ open, onClose, products, categories, specialIds, canCreate }: {
  open: boolean; onClose: () => void; products: KaartProduct[]; categories: KaartCategory[];
  specialIds: Set<string>; canCreate: boolean;
}) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const specials = useNowSpecials();
  const { add } = useKaartMutations();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState('');
  const active = products.filter((p) => p.is_active);
  const current = active.filter((p) => specialIds.has(p.id));
  const list = useMemo(() => {
    const term = norm(q.trim());
    return active.filter((p) => !specialIds.has(p.id) && (!term || norm(p.name).includes(term))).sort(byMenuOrder).slice(0, 60);
  }, [active, q, specialIds]);

  const mark = (p: KaartProduct, on: boolean) => specials.set.mutate({ productId: p.id, on }, {
    onSuccess: () => toast.success(t(on ? 'admin.now.special.on_toast' : 'admin.now.special.off_toast', { name: p.name })),
    onError: () => toast.error(t('admin.now.save_failed')),
  });
  const clearAll = () => specials.clear.mutate(undefined, {
    onSuccess: () => toast.success(t('admin.now.special.none_toast')),
    onError: () => toast.error(t('admin.now.save_failed')),
  });
  const create = async () => {
    // Zelfde prijsinvoer als "Snel toevoegen" op de Kaart ("14,5", "14.50", "€14").
    const p = priceFromInput(price);
    if (!name.trim() || p === null) return;
    try {
      const made = await add.mutateAsync([{ name: name.trim(), price: p, category_id: cat || null }]);
      const id = made[0]?.id;
      if (!id) throw new Error('none');
      await specials.set.mutateAsync({ productId: id, on: true });
      toast.success(t('admin.now.special.on_toast', { name: name.trim() }));
      setName(''); setPrice(''); setCreating(false);
    } catch (e) {
      toast.error(t(kaartErrorKey(e)));
    }
  };
  const busy = specials.set.isPending || specials.clear.isPending || add.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setQ(''); setCreating(false); } }}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('admin.now.special.title')}</SheetTitle>
          <SheetDescription>{t('admin.now.special.help')}</SheetDescription>
        </SheetHeader>

        <section className="space-y-2 rounded-xl border p-3" aria-label={t('admin.now.special.today')}>
          <h3 className="text-sm font-semibold">{t('admin.now.special.today')}</h3>
          {current.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.now.special.none')}</p> : (
            <ul className="space-y-1.5" data-testid="now-special-current">
              {current.map((p) => (
                <li key={p.id} className="flex min-h-11 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(p.price, currency)}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11" disabled={busy} onClick={() => mark(p, false)} aria-label={t('admin.now.special.remove', { name: p.name })}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {current.length > 0 ? (
            <Button type="button" variant="outline" className="h-11 w-full" disabled={busy} onClick={clearAll}>{t('admin.now.special.none_today')}</Button>
          ) : null}
        </section>

        {canCreate ? (
          creating ? (
            <form className="space-y-2 rounded-xl border p-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
              <h3 className="text-sm font-semibold">{t('admin.now.special.new')}</h3>
              <div className="space-y-1">
                <Label htmlFor="now-special-name">{t('admin.now.special.name')}</Label>
                <Input id="now-special-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="now-special-price">{t('admin.now.special.price')}</Label>
                  <Input id="now-special-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 text-right tabular-nums" placeholder="14,50" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="now-special-cat">{t('admin.now.special.category')}</Label>
                  <select id="now-special-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">{t('admin.now.special.no_category')}</option>
                    {categories.filter((c) => c.is_active !== false).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" className="h-11" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
                <Button type="submit" className="h-11 flex-1" disabled={busy || !name.trim() || priceFromInput(price) === null}>
                  {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('admin.now.special.create')}
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" className="h-11 justify-start gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />{t('admin.now.special.new')}
            </Button>
          )
        ) : null}

        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('admin.now.special.pick')}</h3>
          <SearchField value={q} onChange={setQ} label={t('admin.now.search')} />
          <ul className="-mx-2 px-2" data-testid="now-special-list">
            {list.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">{t('admin.now.no_results')}</li> : null}
            {list.map((p) => (
              <li key={p.id} className="flex min-h-12 items-center gap-3 border-b last:border-0">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(p.price, currency)}</span>
                <Button type="button" size="sm" variant="outline" className="h-11 shrink-0 rounded-full px-4" disabled={busy} onClick={() => mark(p, true)}>
                  {t('admin.now.special.make')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </SheetContent>
    </Sheet>
  );
}
