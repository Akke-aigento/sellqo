// EVENT-WORKSPACE-1 — tickettype toevoegen of bewerken met gewoon een naam en een prijs.
// Het ticketproduct eronder maakt SellQo zelf (zie useSaveTicketType).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REENTRY_POLICIES, type ReentryPolicy } from '@/hooks/useEventTicketTypes';
import type { TicketTypeInput } from '@/hooks/useEventWorkspace';

export interface TicketTypeEditTarget {
  id: string;
  product_id: string;
  name: string;
  price: number | null;
  sub_capacity: number | null;
  sales_start: string | null;
  sales_end: string | null;
  reentry_policy: ReentryPolicy;
  is_active: boolean;
  isMain: boolean;
  sold: number;
}

const toLocal = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export function TicketTypeEditorDialog({ open, onOpenChange, target, hasOtherDates, saving, onSubmit }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = nieuw type */
  target: TicketTypeEditTarget | null;
  hasOtherDates: boolean;
  saving: boolean;
  onSubmit: (input: TicketTypeInput) => void;
}) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.workspace.${x}`, o);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cap, setCap] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reentry, setReentry] = useState<ReentryPolicy>('none');
  const [active, setActive] = useState(true);
  const [allDates, setAllDates] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? '');
    setPrice(target?.price != null ? String(target.price) : '');
    setCap(target?.sub_capacity != null ? String(target.sub_capacity) : '');
    setStart(toLocal(target?.sales_start ?? null));
    setEnd(toLocal(target?.sales_end ?? null));
    setReentry(target?.reentry_policy ?? 'none');
    setActive(target?.is_active ?? true);
    setAllDates(true);
  }, [open, target]);

  const priceN = price.trim() === '' ? NaN : Number(price.replace(',', '.'));
  const capN = cap.trim() === '' ? null : Number(cap);
  const windowBad = !!start && !!end && new Date(end) < new Date(start);
  const nameBad = !target?.isMain && name.trim().length < 2;
  const invalid = nameBad || !Number.isFinite(priceN) || priceN < 0 || (capN !== null && (!Number.isInteger(capN) || capN < 0)) || windowBad;

  const submit = () => {
    if (invalid) return;
    if (target && capN !== null && capN < target.sold && !window.confirm(t('events.ticketTypes.guards.capacityBelowSold', { sold: target.sold }))) return;
    onSubmit({
      existing: target ? { id: target.id, product_id: target.product_id } : null,
      name: name.trim(), price: priceN, sub_capacity: capN,
      sales_start: fromLocal(start), sales_end: fromLocal(end),
      reentry_policy: reentry, is_active: active,
      apply_to_other_dates: !target && hasOtherDates && allDates,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? k('tt_edit') : k('tt_new')}</DialogTitle>
          <DialogDescription>{target?.isMain ? k('tt_main_hint') : k('tt_hint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-1.5">
              <Label>{k('tt_name')}</Label>
              <Input value={name} disabled={target?.isMain} onChange={(e) => setName(e.target.value)} placeholder={k('tt_name_ph')} autoFocus={!target} />
            </div>
            <div className="space-y-1.5">
              <Label>{k('tt_price')}</Label>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25" />
            </div>
          </div>
          {target?.isMain && <p className="-mt-2 text-xs text-muted-foreground">{k('tt_main_price_hint')}</p>}
          <div className="space-y-1.5">
            <Label>{k('tt_capacity')}</Label>
            <Input type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} placeholder={k('tt_capacity_ph')} />
            <p className="text-xs text-muted-foreground">{k('tt_capacity_hint')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{k('tt_sales_start')}</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{k('tt_sales_end')}</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          {windowBad && <p className="text-sm text-destructive">{t('events.ticketTypes.form.windowInvalid')}</p>}
          <p className="-mt-2 text-xs text-muted-foreground">{k('tt_window_hint')}</p>
          <div className="space-y-1.5">
            <Label>{t('events.ticketTypes.form.reentry')}</Label>
            <Select value={reentry} onValueChange={(v) => setReentry(v as ReentryPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REENTRY_POLICIES.map((p) => <SelectItem key={p} value={p}>{t(`events.ticketTypes.reentry.${p}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />{k('tt_active')}</label>
          {!target && hasOtherDates && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={allDates} onCheckedChange={(v) => setAllDates(v === true)} />{k('tt_all_dates')}</label>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel', 'Annuleren')}</Button>
          <Button onClick={submit} disabled={invalid || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{k('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
