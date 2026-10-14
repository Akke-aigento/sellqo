// FEST-1 — combitickets: één aankoop, een ticket per dag (en camping, VIP …).
// Een combi is een ticketproduct zonder eigen datum. Per onderdeel kies je een datum en het
// tickettype waaronder het meetelt voor de capaciteit. Bij betaling krijgt de koper per
// onderdeel een gewoon ticket met eigen QR, dus de deurscanner merkt niets nieuws.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Layers, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useBundleOptions, useBundles, useCreateBundle, useUpdateBundle } from '@/hooks/useFestival';
import { formatCurrency } from '@/lib/utils';

const fmtDate = (d: string, locale: string) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

export default function EventBundles() {
  const { t, i18n } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.bundles.${x}`, o);
  const { data: bundles, isLoading } = useBundles();
  const update = useUpdateBundle();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('events.venues.back_to_events')}
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Layers className="h-5 w-5" /> {k('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{k('subtitle')}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />{k('new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !bundles?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{k('empty_title')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{k('empty_body')}</p>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{k('new')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bundles.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{b.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(b.price)} · {k('sold', { count: b.sold })}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!b.is_active && <Badge variant="secondary">{k('inactive')}</Badge>}
                    {b.hidden && <Badge variant="outline">{k('hidden')}</Badge>}
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {b.items.map((it) => (
                    <li key={it.event_detail_id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{it.event_name}</span>
                      <span className="shrink-0 text-muted-foreground">{fmtDate(it.event_date, i18n.language)}{it.type_name && it.type_name !== it.event_name ? ` · ${it.type_name}` : ''}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-4 border-t pt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={(v) => update.mutate({ id: b.id, patch: { is_active: v } }, { onError: () => toast.error(k('save_failed')) })}
                    />
                    {k('on_sale')}
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={!b.hidden}
                      onCheckedChange={(v) => update.mutate({ id: b.id, patch: { hide_from_storefront: !v } }, { onError: () => toast.error(k('save_failed')) })}
                    />
                    {k('visible')}
                  </label>
                  <Link to={`/admin/products/${b.id}/edit`} className="ml-auto text-primary hover:underline">{k('edit_product')}</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewBundleDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewBundleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.bundles.${x}`, o);
  const { data: options, isLoading } = useBundleOptions();
  const create = useCreateBundle();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [hidden, setHidden] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const usable = useMemo(() => (options ?? []).filter((o) => !o.seated && o.types.length > 0), [options]);
  const seatedCount = (options ?? []).filter((o) => o.seated).length;
  const components = usable.filter((o) => picked[o.event_detail_id]).map((o) => ({ event_detail_id: o.event_detail_id, product_id: picked[o.event_detail_id] }));
  const priceNum = Number(price.replace(',', '.'));
  const valid = name.trim().length > 1 && components.length >= 2 && Number.isFinite(priceNum) && priceNum >= 0 && price.trim() !== '';

  const reset = () => { setName(''); setDescription(''); setPrice(''); setHidden(false); setPicked({}); };

  const submit = async () => {
    if (!valid) return;
    try {
      await create.mutateAsync({ name, description, price: priceNum, hidden, components });
      toast.success(k('created'));
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'limit' ? k('limit') : k('create_failed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{k('new')}</DialogTitle>
          <DialogDescription>{k('new_hint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bundle-name">{k('name')}</Label>
            <Input id="bundle-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={k('name_placeholder')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bundle-desc">{k('description')}</Label>
            <Textarea id="bundle-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bundle-price">{k('price')}</Label>
            <Input id="bundle-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="99" className="max-w-[10rem]" />
          </div>
          <div className="space-y-2">
            <Label>{k('components')}</Label>
            <p className="text-xs text-muted-foreground">{k('components_hint')}</p>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : usable.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{k('no_dates')}</p>
            ) : (
              <div className="space-y-2">
                {usable.map((o) => {
                  const on = !!picked[o.event_detail_id];
                  return (
                    <div key={o.event_detail_id} className={`rounded-md border p-2 ${on ? 'border-primary bg-primary/5' : ''}`}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => setPicked((p) => {
                            const next = { ...p };
                            if (v) next[o.event_detail_id] = o.types[0].product_id; else delete next[o.event_detail_id];
                            return next;
                          })}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{o.event_name}</span>
                        <span className="shrink-0 text-muted-foreground">{fmtDate(o.event_date, i18n.language)}{o.start_time ? ` · ${o.start_time.slice(0, 5)}` : ''}</span>
                      </label>
                      {on && o.types.length > 1 && (
                        <div className="mt-2 pl-6">
                          <Select value={picked[o.event_detail_id]} onValueChange={(v) => setPicked((p) => ({ ...p, [o.event_detail_id]: v }))}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {o.types.map((ty) => <SelectItem key={ty.product_id} value={ty.product_id}>{ty.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {seatedCount > 0 && <p className="text-xs text-muted-foreground">{k('seated_skipped', { count: seatedCount })}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!hidden} onCheckedChange={(v) => setHidden(!v)} />
            {k('visible_now')}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {components.length >= 2 ? k('create_n', { count: components.length }) : k('pick_two')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
