// EVENT-SETTINGS (fase 4d) — bewerkbare kern van een event-datum.
//
// Puur UI: schrijft via de bestaande hook useUpdateEventDate op public.event_details.
// Alle consumers (storefront-api, check-in, issuance) lezen die tabel live, dus er is
// geen contract- of engine-wijziging nodig. capacity=NULL betekent "ongelimiteerd" en
// wordt hier als echte NULL geschreven — nooit als 0.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Settings2 } from 'lucide-react';
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
          <Settings2 className="h-4 w-4" /> {t('events.settings.title')}
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

        <p className="text-xs text-muted-foreground">{t('events.settings.earlyBirdNote')}</p>

        <div className="flex justify-end">
          <Button onClick={handleSaveClick} disabled={!isDirty || update.isPending || capacityInvalid || dateInvalid}>
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
          if (capacityInvalid || dateInvalid) return;
          handleSaveClick();
        }}
        onCancel={resetForm}
        saveLabel={t('events.settings.save')}
        cancelLabel={t('common.cancel', 'Annuleren')}
      />
    </Card>
  );
}
