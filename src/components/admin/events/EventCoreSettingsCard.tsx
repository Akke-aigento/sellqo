// EVENT-SETTINGS (fase 4d) — bewerkbare kern van een event-datum.
//
// Puur UI: schrijft via de bestaande hook useUpdateEventDate op public.event_details.
// Alle consumers (storefront-api, check-in, issuance) lezen die tabel live, dus er is
// geen contract- of engine-wijziging nodig. capacity=NULL betekent "ongelimiteerd" en
// wordt hier als echte NULL geschreven — nooit als 0.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarDays, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUpdateEventDate, type EventStatus } from '@/hooks/useEventDetails';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';

const STATUSES: EventStatus[] = ['scheduled', 'confirmed', 'cancelled', 'completed', 'skipped', 'merged'];
const HIDING_STATUSES = new Set<EventStatus>(['cancelled', 'skipped', 'merged']);

export interface EventCoreValues {
  id: string;
  product_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  location_name: string | null;
  meeting_point: string | null;
  capacity: number | null;
  min_attendees: number;
  early_bird_price: number | null;
  early_bird_deadline: string | null;
  early_bird_quantity: number | null;
}

interface FormState {
  status: EventStatus;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  meeting_point: string;
  capacity: string;
  unlimited: boolean;
  min_attendees: string;
  eb_on: boolean;
  eb_price: string;
  eb_deadline: string;
  eb_quantity: string;
}

const toForm = (e: EventCoreValues): FormState => ({
  status: (STATUSES.includes(e.status as EventStatus) ? e.status : 'scheduled') as EventStatus,
  event_date: e.event_date ?? '',
  start_time: (e.start_time ?? '').slice(0, 5),
  end_time: (e.end_time ?? '').slice(0, 5),
  location_name: e.location_name ?? '',
  meeting_point: e.meeting_point ?? '',
  capacity: e.capacity == null ? '' : String(e.capacity),
  unlimited: e.capacity == null,
  min_attendees: String(e.min_attendees ?? 0),
  eb_on: e.early_bird_price != null,
  eb_price: e.early_bird_price == null ? '' : String(e.early_bird_price),
  // datetime-local werkt in de lokale tijd van de beheerder.
  eb_deadline: e.early_bird_deadline ? format(new Date(e.early_bird_deadline), "yyyy-MM-dd'T'HH:mm") : '',
  eb_quantity: e.early_bird_quantity == null ? '' : String(e.early_bird_quantity),
});

export function EventCoreSettingsCard({
  event, sold, onSaved,
}: { event: EventCoreValues; sold: number; onSaved?: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateEventDate(event.product_id ?? undefined);
  const [form, setForm] = useState<FormState>(() => toForm(event));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { setForm(toForm(event)); }, [event]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Dirty-state: vergelijk de huidige form met de oorspronkelijke event-waarden.
  // FormState is plat (strings/bools), dus een stabiele JSON-vergelijking volstaat.
  const isDirty = JSON.stringify(form) !== JSON.stringify(toForm(event));
  const resetForm = () => setForm(toForm(event));

  const capacityNum = form.unlimited || form.capacity.trim() === '' ? null : Number(form.capacity);
  const capacityInvalid = !form.unlimited && (form.capacity.trim() === '' || !Number.isFinite(capacityNum!) || (capacityNum as number) < 0);
  const dateInvalid = !form.event_date || !form.start_time;
  const ebPrice = form.eb_price.trim() === '' ? null : Number(form.eb_price.replace(',', '.'));
  const ebQty = form.eb_quantity.trim() === '' ? null : Number(form.eb_quantity);
  const ebInvalid = form.eb_on && (ebPrice === null || !Number.isFinite(ebPrice) || ebPrice < 0
    || (ebQty !== null && (!Number.isInteger(ebQty) || ebQty < 1)) || (form.eb_quantity.trim() === '' && form.eb_deadline === ''));

  const hidesEvent = HIDING_STATUSES.has(form.status) && !HIDING_STATUSES.has(event.status as EventStatus);
  const lowersCapacity = capacityNum !== null && sold > 0 && capacityNum < sold;
  const needsConfirm = hidesEvent || lowersCapacity;

  const doSave = async () => {
    await update.mutateAsync({
      id: event.id,
      data: {
        status: form.status,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time.trim() === '' ? null : form.end_time,
        location_name: form.location_name.trim() || null,
        meeting_point: form.meeting_point.trim() || null,
        capacity: capacityNum,
        min_attendees: Number(form.min_attendees || 0),
        early_bird_price: form.eb_on ? ebPrice : null,
        early_bird_deadline: form.eb_on && form.eb_deadline ? new Date(form.eb_deadline).toISOString() : null,
        early_bird_quantity: form.eb_on ? ebQty : null,
      },
    });
    onSaved?.();
  };

  const handleSaveClick = () => {
    if (needsConfirm) { setConfirmOpen(true); return; }
    void doSave();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> {t('events.workspace.date_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.status')}</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v as EventStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`events.status.${s}`, s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.date')}</Label>
            <Input type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.startTime')}</Label>
            <Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.endTime')}</Label>
            <Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.locationName')}</Label>
            <Input value={form.location_name} onChange={(e) => set('location_name', e.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.meetingPoint')}</Label>
            <Input value={form.meeting_point} onChange={(e) => set('meeting_point', e.target.value)} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.capacity')}</Label>
            <Input
              type="number" min={0} inputMode="numeric"
              value={form.unlimited ? '' : form.capacity}
              disabled={form.unlimited}
              onChange={(e) => set('capacity', e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={form.unlimited}
                onCheckedChange={(v) => set('unlimited', v === true)}
              />
              {t('events.settings.unlimitedCapacity')}
            </label>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label>{t('events.settings.minAttendees')}</Label>
            <Input
              type="number" min={0} inputMode="numeric"
              value={form.min_attendees}
              onChange={(e) => set('min_attendees', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{t('events.workspace.eb_title')}</span>
              <span className="block text-xs text-muted-foreground">{t('events.workspace.eb_hint')}</span>
            </span>
            <Checkbox checked={form.eb_on} onCheckedChange={(v) => set('eb_on', v === true)} />
          </label>
          {form.eb_on && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 min-w-0">
                <Label>{t('events.workspace.eb_price')}</Label>
                <Input inputMode="decimal" value={form.eb_price} onChange={(e) => set('eb_price', e.target.value)} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>{t('events.workspace.eb_until')}</Label>
                <Input type="datetime-local" value={form.eb_deadline} onChange={(e) => set('eb_deadline', e.target.value)} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>{t('events.workspace.eb_qty')}</Label>
                <Input type="number" min={1} value={form.eb_quantity} onChange={(e) => set('eb_quantity', e.target.value)} placeholder={t('events.workspace.eb_qty_ph')} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">{t('events.workspace.eb_rule')}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveClick} disabled={!isDirty || update.isPending || capacityInvalid || dateInvalid || ebInvalid}>
            {update.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {t('events.settings.save')}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.settings.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {hidesEvent && (
                <span className="block">
                  {t('events.settings.guards.hidingStatus', {
                    status: t(`events.status.${form.status}`, form.status),
                  })}
                </span>
              )}
              {lowersCapacity && (
                <span className="block">
                  {t('events.settings.guards.capacityBelowSold', { sold })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Annuleren')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); void doSave(); }}>
              {t('events.settings.confirmContinue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FloatingSaveBar
        isDirty={isDirty}
        isSaving={update.isPending}
        onSave={() => {
          if (capacityInvalid || dateInvalid || ebInvalid) return;
          handleSaveClick();
        }}
        onCancel={resetForm}
        saveLabel={t('events.settings.save')}
        cancelLabel={t('common.cancel', 'Annuleren')}
      />
    </Card>
  );
}
