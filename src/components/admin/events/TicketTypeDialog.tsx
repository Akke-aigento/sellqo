// EVENT-SYSTEEM FASE 4b — aanmaak/bewerk-dialog voor tickettypes.
//
// Naam en prijs zijn read-only en komen uit het gekoppelde product (één bron van
// waarheid). Harde validatie: sales_end < sales_start blokkeert opslaan.
// Capaciteit onder het al verkochte aantal waarschuwt (confirm), maar blokkeert niet —
// de DB is daar ook niet strenger in en bestaande tickets blijven geldig.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  REENTRY_POLICIES, type ReentryPolicy, type TicketProductOption, type TicketTypeFormData,
} from '@/hooks/useEventTicketTypes';

export interface TicketTypeEditable {
  id: string;
  product_id: string;
  sub_capacity: number | null;
  sales_start: string | null;
  sales_end: string | null;
  sort_order: number;
  is_active: boolean;
  reentry_policy: ReentryPolicy;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = nieuw tickettype */
  editing: TicketTypeEditable | null;
  products: TicketProductOption[];
  /** product_id's die al gekoppeld zijn aan dit event (unique-constraint) */
  usedProductIds: string[];
  /** al verkochte tickets per product_id (voor de capaciteit-waarschuwing) */
  soldForProduct: (productId: string) => number;
  saving: boolean;
  onSubmit: (form: TicketTypeFormData) => void;
}

/** ISO-timestamp → {date, time} in lokale tijd van de beheerder. */
const splitStamp = (iso: string | null) => {
  if (!iso) return { date: undefined as Date | undefined, time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: undefined as Date | undefined, time: '' };
  return { date: d as Date | undefined, time: format(d, 'HH:mm') };
};

/** {date, time} → ISO-timestamp; time leeg = 00:00. */
const joinStamp = (date: Date | undefined, time: string): string | null => {
  if (!date) return null;
  const [h, m] = (time || '00:00').split(':');
  const d = new Date(date);
  d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return d.toISOString();
};

export function TicketTypeDialog({
  open, onOpenChange, editing, products, usedProductIds, soldForProduct, saving, onSubmit,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [productId, setProductId] = useState('');
  const [subCapacity, setSubCapacity] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [reentry, setReentry] = useState<ReentryPolicy>('none');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const s = splitStamp(editing.sales_start);
      const e = splitStamp(editing.sales_end);
      setProductId(editing.product_id);
      setSubCapacity(editing.sub_capacity != null ? String(editing.sub_capacity) : '');
      setStartDate(s.date); setStartTime(s.time);
      setEndDate(e.date); setEndTime(e.time);
      setSortOrder(String(editing.sort_order ?? 0));
      setReentry(editing.reentry_policy ?? 'none');
      setIsActive(editing.is_active);
    } else {
      setProductId(''); setSubCapacity('');
      setStartDate(undefined); setStartTime('');
      setEndDate(undefined); setEndTime('');
      setSortOrder('0'); setReentry('none'); setIsActive(true);
    }
  }, [open, editing]);

  const available = useMemo(
    () => products.filter((p) => p.id === editing?.product_id || !usedProductIds.includes(p.id)),
    [products, usedProductIds, editing?.product_id],
  );

  const selected = products.find((p) => p.id === productId) ?? null;

  const salesStart = joinStamp(startDate, startTime);
  const salesEnd = joinStamp(endDate, endTime);
  const windowInvalid = !!salesStart && !!salesEnd && new Date(salesEnd) < new Date(salesStart);

  const parsedCapacity = subCapacity.trim() === '' ? null : Number(subCapacity);
  const sold = productId ? soldForProduct(productId) : 0;
  const capacityBelowSold = parsedCapacity != null && parsedCapacity < sold;

  const canSave = !!productId && !windowInvalid && !saving;

  const handleSave = () => {
    if (!canSave) return;
    if (capacityBelowSold) {
      const ok = window.confirm(t('events.ticketTypes.guards.capacityBelowSold', { count: sold }));
      if (!ok) return;
    }
    onSubmit({
      product_id: productId,
      sub_capacity: parsedCapacity != null && Number.isFinite(parsedCapacity) ? parsedCapacity : null,
      sales_start: salesStart,
      sales_end: salesEnd,
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
      reentry_policy: reentry,
    });
  };

  const dateField = (
    label: string,
    date: Date | undefined,
    setDate: (d: Date | undefined) => void,
    time: string,
    setTime: (v: string) => void,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('flex-1 min-w-[8rem] justify-start font-normal', !date && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {date ? format(date, 'dd-MM-yyyy') : t('events.ticketTypes.form.pickDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-[7.5rem]"
          disabled={!date}
        />
        {date && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { setDate(undefined); setTime(''); }}
            aria-label={t('events.ticketTypes.form.clear')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('events.ticketTypes.form.editTitle') : t('events.ticketTypes.form.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('events.ticketTypes.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product-koppeling */}
          <div className="space-y-2">
            <Label>{t('events.ticketTypes.form.product')}</Label>
            {available.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('events.ticketTypes.form.noProducts')}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate('/admin/products/new')}>
                  {t('events.ticketTypes.form.createProduct')}
                </Button>
              </div>
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('events.ticketTypes.form.productPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selected && (
              <p className="text-xs text-muted-foreground">
                {t('events.ticketTypes.form.priceFromProduct')}:{' '}
                {selected.price != null ? `€ ${Number(selected.price).toFixed(2)}` : '—'}
              </p>
            )}
          </div>

          {/* Capaciteit */}
          <div className="space-y-2">
            <Label htmlFor="tt-capacity">{t('events.ticketTypes.form.subCapacity')}</Label>
            <Input
              id="tt-capacity"
              type="number"
              min={0}
              value={subCapacity}
              onChange={(e) => setSubCapacity(e.target.value)}
              placeholder={t('events.ticketTypes.form.unlimited')}
            />
            <p className="text-xs text-muted-foreground">{t('events.ticketTypes.form.subCapacityHint')}</p>
          </div>

          {dateField(t('events.ticketTypes.form.salesStart'), startDate, setStartDate, startTime, setStartTime)}
          {dateField(t('events.ticketTypes.form.salesEnd'), endDate, setEndDate, endTime, setEndTime)}
          {windowInvalid && (
            <p className="text-sm text-destructive">{t('events.ticketTypes.form.windowInvalid')}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tt-sort">{t('events.ticketTypes.form.sortOrder')}</Label>
              <Input
                id="tt-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('events.ticketTypes.form.reentry')}</Label>
              <Select value={reentry} onValueChange={(v) => setReentry(v as ReentryPolicy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REENTRY_POLICIES.map((p) => (
                    <SelectItem key={p} value={p}>{t(`events.ticketTypes.reentry.${p}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="tt-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="tt-active" className="font-normal">
              {t('events.ticketTypes.form.isActive')}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('events.ticketTypes.form.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('events.ticketTypes.form.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
